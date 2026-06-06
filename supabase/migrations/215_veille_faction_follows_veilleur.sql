-- 215_veille_faction_follows_veilleur.sql
-- WHY : place_veille.faction_id est dénormalisé à la plantation. Quand le veilleur
-- change de faction (set_user_faction, mig 211), ses veilles gardaient l'ANCIENNE
-- couleur → un lieu veillé par un Pèlerin restait affiché bleu (cas remonté :
-- "Château de montsegur" / "Le Chant de Montségur", veille nordique plantée en
-- févr. 2026, veilleur passé depuis chez les Pèlerins des Brumes).
--
--   1) backfill : aligner les veilles existantes sur la faction actuelle du veilleur
--   2) set_user_faction resynchronise les veilles du joueur à chaque bascule
--      (hors expéditions neutres `is_neutral`).
--
-- La couleur d'un lieu veillé suit donc désormais la faction COURANTE de son veilleur.

BEGIN;

-- 1) Backfill des veilles périmées (≠ faction actuelle du veilleur)
UPDATE place_veille v
SET faction_id = u.faction_id
FROM users u
WHERE u.id = v.veilleur_user_id
  AND NOT v.is_neutral
  AND u.faction_id IS NOT NULL
  AND v.faction_id IS DISTINCT FROM u.faction_id;

-- 2) set_user_faction : resync des veilles dans la branche "changement de faction"
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

    -- Les lieux veillés par le joueur suivent sa nouvelle faction (hors expéditions
    -- neutres). Sans ça, la couleur du territoire resterait figée à l'ancienne faction.
    UPDATE place_veille
    SET faction_id = p_faction_id
    WHERE veilleur_user_id = p_user_id AND NOT is_neutral;

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

COMMIT;
