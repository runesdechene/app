-- 210_faction_join_activity.sql
-- WHY : annoncer dans le fil d'activité (toasts) quand une Faction GAGNE un
-- joueur — 1er choix d'un nouveau venu OU bascule d'un joueur existant vers elle
-- (jamais le départ « sans-bannière »). On insère une ligne activity_log de type
-- 'faction_join' que l'abonnement Realtime (usePlayer.ts) et get_recent_activity
-- (historique, sans filtre de type) diffusent à tous les joueurs.
--
-- set_user_faction reconstruit depuis la def LIVE (cf. migrations-workflow.md
-- « lire avant de réécrire »). Delta = l'INSERT activity_log dans les 2 branches
-- où une faction est gagnée. Le reste (cooldown, auto-découverte des lieux de
-- l'ancienne faction, purge des titres de faction) est conservé à l'identique.

CREATE OR REPLACE FUNCTION public.set_user_faction(p_user_id text, p_faction_id text)
  RETURNS json LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_old_faction_id TEXT;
  v_last_change TIMESTAMPTZ;
  v_cooldown_days INT;
  v_days_remaining INT;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  IF p_faction_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM factions WHERE id = p_faction_id) THEN
      RETURN json_build_object('error', 'faction_not_found');
    END IF;
  END IF;

  SELECT faction_id, faction_changed_at
  INTO v_old_faction_id, v_last_change
  FROM users WHERE id = p_user_id;

  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'faction_change_cooldown_days'), 30)
  INTO v_cooldown_days;

  IF v_old_faction_id IS NOT NULL
     AND p_faction_id IS NOT NULL
     AND v_old_faction_id != p_faction_id THEN

    IF v_last_change IS NOT NULL AND (NOW() - v_last_change) < (v_cooldown_days || ' days')::INTERVAL THEN
      v_days_remaining := v_cooldown_days - EXTRACT(DAY FROM (NOW() - v_last_change))::INT;
      RETURN json_build_object('error', 'cooldown', 'daysRemaining', GREATEST(1, v_days_remaining));
    END IF;

    INSERT INTO places_discovered (user_id, place_id, method)
    SELECT p_user_id, p.id, 'remote'
    FROM places p
    WHERE p.faction_id = v_old_faction_id
    ON CONFLICT (user_id, place_id) DO NOTHING;

    UPDATE users
    SET faction_id = p_faction_id,
        faction_changed_at = NOW(),
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
