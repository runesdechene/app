-- 271_faction_join_leave_activity.sql
-- WHY : journaliser dans le fil d'activité quand un joueur rejoint (faction_join,
-- déjà rendu côté front) ou quitte (faction_leave, nouveau) une Compagnie.
-- Delta vs 270 = les INSERT activity_log. Le reste est identique à 270.
-- ADDITIF / sûr pour le live.

CREATE OR REPLACE FUNCTION public.join_faction(p_user_id text, p_faction_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_max int; v_count int; v_active text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF NOT EXISTS (SELECT 1 FROM factions WHERE id = p_faction_id AND retired = false) THEN
    RETURN json_build_object('error','not_found'); END IF;
  IF EXISTS (SELECT 1 FROM faction_members WHERE faction_id = p_faction_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error','already_member'); END IF;
  v_max := COALESCE((SELECT value::int FROM app_settings WHERE key = 'faction_max_count'), 2);
  SELECT count(*) INTO v_count FROM faction_members WHERE user_id = p_user_id;
  IF v_count >= v_max THEN RETURN json_build_object('error','too_many'); END IF;

  INSERT INTO faction_members (faction_id, user_id) VALUES (p_faction_id, p_user_id);
  SELECT faction_id INTO v_active FROM users WHERE id = p_user_id;
  IF v_active IS NULL THEN
    UPDATE users SET faction_id = p_faction_id WHERE id = p_user_id;
    v_active := p_faction_id;
  END IF;

  -- Fil d'activité : une Compagnie gagne un membre
  INSERT INTO activity_log (type, actor_id, faction_id, data)
  SELECT 'faction_join', p_user_id, p_faction_id,
         jsonb_build_object(
           'actorName',      COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
           'factionTitle',   f.title,
           'factionColor',   f.color,
           'factionPattern', f.pattern
         )
  FROM users u, factions f WHERE u.id = p_user_id AND f.id = p_faction_id;

  RETURN json_build_object('success', true, 'activeFactionId', v_active);
END;$$;

CREATE OR REPLACE FUNCTION public.leave_faction(p_user_id text, p_faction_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_active text; v_other text; v_remaining int; v_extinguished boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF NOT EXISTS (SELECT 1 FROM faction_members WHERE faction_id = p_faction_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error','not_member'); END IF;

  DELETE FROM faction_members WHERE faction_id = p_faction_id AND user_id = p_user_id;

  SELECT faction_id INTO v_active FROM users WHERE id = p_user_id;
  IF v_active = p_faction_id THEN
    SELECT faction_id INTO v_other FROM faction_members WHERE user_id = p_user_id ORDER BY joined_at LIMIT 1;
    UPDATE users SET faction_id = v_other WHERE id = p_user_id;
  END IF;

  -- Fil d'activité : un membre quitte une Compagnie (avant l'extinction éventuelle)
  INSERT INTO activity_log (type, actor_id, faction_id, data)
  SELECT 'faction_leave', p_user_id, p_faction_id,
         jsonb_build_object(
           'actorName',      COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
           'factionTitle',   f.title,
           'factionColor',   f.color,
           'factionPattern', f.pattern
         )
  FROM users u, factions f WHERE u.id = p_user_id AND f.id = p_faction_id;

  SELECT count(*) INTO v_remaining FROM faction_members WHERE faction_id = p_faction_id;
  IF v_remaining = 0 THEN
    UPDATE factions SET retired = true, updated_at = now() WHERE id = p_faction_id;
    v_extinguished := true;
  END IF;

  RETURN json_build_object('success', true, 'extinguished', v_extinguished);
END;$$;
