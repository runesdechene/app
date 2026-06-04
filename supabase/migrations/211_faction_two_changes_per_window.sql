-- 211_faction_two_changes_per_window.sql
-- WHY : autoriser 2 changements de Faction par fenêtre de 30 jours (au lieu d'1),
-- pour rattraper une erreur de choix. Modèle : fenêtre ancrée au 1er changement,
-- compteur incrémenté à chaque bascule ; au-delà de la limite → cooldown jusqu'à
-- 30j après l'ouverture de la fenêtre ; passé ce délai, le prochain changement
-- rouvre une fenêtre neuve. Le 1er CHOIX (pas d'ancienne faction) ne consomme rien.
--
-- Limite tunable via app_settings.faction_max_changes_per_window (défaut 2).
-- set_user_faction reconstruit depuis la def LIVE (post-mig 210, garde les
-- INSERT activity_log 'faction_join' + l'auto-découverte des lieux de l'ancienne
-- faction). Delta = gate compteur de fenêtre à la place du cooldown « 1 fois ».

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS faction_change_window_start timestamptz,
  ADD COLUMN IF NOT EXISTS faction_change_count        int NOT NULL DEFAULT 0;

-- Backfill : on traite le dernier changement connu comme le 1er d'une fenêtre
-- (1/2 consommé). Un joueur ayant changé récemment garde donc droit à 1 bascule.
UPDATE public.users
SET faction_change_window_start = faction_changed_at,
    faction_change_count = 1
WHERE faction_changed_at IS NOT NULL
  AND faction_change_window_start IS NULL;

-- Limite tunable (défaut 2)
INSERT INTO public.app_settings (key, value)
VALUES ('faction_max_changes_per_window', '2')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_user_faction(p_user_id text, p_faction_id text)
  RETURNS json LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_old_faction_id   TEXT;
  v_cooldown_days    INT;
  v_max_changes      INT;
  v_window_start     TIMESTAMPTZ;
  v_change_count     INT;
  v_new_window_start TIMESTAMPTZ;
  v_new_count        INT;
  v_days_remaining   INT;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  IF p_faction_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM factions WHERE id = p_faction_id) THEN
      RETURN json_build_object('error', 'faction_not_found');
    END IF;
  END IF;

  SELECT faction_id, faction_change_window_start, faction_change_count
  INTO v_old_faction_id, v_window_start, v_change_count
  FROM users WHERE id = p_user_id;

  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'faction_change_cooldown_days'), 30)
  INTO v_cooldown_days;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'faction_max_changes_per_window'), 2)
  INTO v_max_changes;

  IF v_old_faction_id IS NOT NULL
     AND p_faction_id IS NOT NULL
     AND v_old_faction_id != p_faction_id THEN

    -- Fenêtre absente ou expirée → ce changement ouvre une fenêtre neuve.
    IF v_window_start IS NULL OR (NOW() - v_window_start) >= (v_cooldown_days || ' days')::INTERVAL THEN
      v_new_window_start := NOW();
      v_new_count := 1;
    ELSE
      -- Dans la fenêtre courante : limite atteinte → cooldown.
      IF v_change_count >= v_max_changes THEN
        v_days_remaining := v_cooldown_days - EXTRACT(DAY FROM (NOW() - v_window_start))::INT;
        RETURN json_build_object('error', 'cooldown', 'daysRemaining', GREATEST(1, v_days_remaining));
      END IF;
      v_new_window_start := v_window_start;
      v_new_count := v_change_count + 1;
    END IF;

    INSERT INTO places_discovered (user_id, place_id, method)
    SELECT p_user_id, p.id, 'remote'
    FROM places p
    WHERE p.faction_id = v_old_faction_id
    ON CONFLICT (user_id, place_id) DO NOTHING;

    UPDATE users
    SET faction_id = p_faction_id,
        faction_changed_at = NOW(),
        faction_change_window_start = v_new_window_start,
        faction_change_count = v_new_count,
        displayed_title_ids_v3 = (
          SELECT COALESCE(array_agg(tid), '{}')
          FROM unnest(displayed_title_ids_v3) AS tid
          WHERE tid < 0
            OR NOT EXISTS (SELECT 1 FROM titles t WHERE t.id = tid AND t.type = 'faction' AND t.faction_id = v_old_faction_id)
        ),
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Une faction gagne un joueur (bascule) → fil d'activité
    INSERT INTO activity_log (type, actor_id, faction_id, data)
    SELECT 'faction_join', p_user_id, p_faction_id,
           jsonb_build_object(
             'actorName',      COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
             'factionTitle',   f.title,
             'factionColor',   f.color,
             'factionPattern', f.pattern
           )
    FROM users u, factions f
    WHERE u.id = p_user_id AND f.id = p_faction_id;

    RETURN json_build_object('success', true);
  ELSE
    UPDATE users SET faction_id = p_faction_id, updated_at = NOW() WHERE id = p_user_id;

    -- Une faction gagne un joueur (1er choix : pas d'ancienne faction) → fil d'activité
    IF v_old_faction_id IS NULL AND p_faction_id IS NOT NULL THEN
      INSERT INTO activity_log (type, actor_id, faction_id, data)
      SELECT 'faction_join', p_user_id, p_faction_id,
             jsonb_build_object(
               'actorName',      COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
               'factionTitle',   f.title,
               'factionColor',   f.color,
               'factionPattern', f.pattern
             )
      FROM users u, factions f
      WHERE u.id = p_user_id AND f.id = p_faction_id;
    END IF;

    RETURN json_build_object('success', true);
  END IF;
END;
$function$;
