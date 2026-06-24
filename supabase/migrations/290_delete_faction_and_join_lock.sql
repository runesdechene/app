-- 290_delete_faction_and_join_lock.sql
-- WHY :
--  1) delete_faction : le FONDATEUR (created_by) peut supprimer sa Compagnie. Soft-retire
--     (retired=true) pour préserver l'intégrité référentielle + libère les membres
--     (faction_id → autre Compagnie ou NULL), grise ses territoires, vide les adhésions.
--  2) Lock soft à l'adhésion : on ne peut pas rejoindre une Compagnie trop peuplée par
--     rapport à la moyenne, mais seulement au-delà d'un plancher absolu (anti-boule-de-neige
--     sans casser le début de vie). Fonder reste toujours possible (soupape).
-- ADDITIF.

INSERT INTO public.app_settings(key, value)
  SELECT 'faction_lock_floor', '8'  WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key='faction_lock_floor');
INSERT INTO public.app_settings(key, value)
  SELECT 'faction_lock_ratio', '4'  WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key='faction_lock_ratio');

-- ── Suppression d'une Compagnie (fondateur uniquement) ──
CREATE OR REPLACE FUNCTION public.delete_faction(p_user_id text, p_faction_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_creator text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN RETURN json_build_object('error','unauthorized'); END IF;
  SELECT created_by INTO v_creator FROM factions WHERE id = p_faction_id AND retired = false;
  IF v_creator IS NULL THEN RETURN json_build_object('error','not_found'); END IF;
  IF v_creator IS DISTINCT FROM p_user_id THEN RETURN json_build_object('error','not_founder'); END IF;

  -- Territoires de la Compagnie → neutres (gris)
  UPDATE place_veille SET faction_id = NULL WHERE faction_id = p_faction_id;

  -- Membres dont la bannière active = cette Compagnie → bascule sur une autre adhésion
  -- non-retirée si elle existe, sinon NULL (factionless).
  UPDATE users u SET faction_id = (
    SELECT fm.faction_id FROM faction_members fm
    JOIN factions f ON f.id = fm.faction_id
    WHERE fm.user_id = u.id AND fm.faction_id <> p_faction_id AND f.retired = false
    ORDER BY fm.joined_at LIMIT 1
  )
  WHERE u.faction_id = p_faction_id;

  DELETE FROM faction_members WHERE faction_id = p_faction_id;

  UPDATE factions SET retired = true, updated_at = now() WHERE id = p_faction_id;

  RETURN json_build_object('success', true);
END;$$;
GRANT EXECUTE ON FUNCTION public.delete_faction(text,text) TO authenticated, service_role;

-- ── join_faction : + lock soft (trop peuplée vs moyenne, au-delà d'un plancher) ──
CREATE OR REPLACE FUNCTION public.join_faction(p_user_id text, p_faction_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_max int; v_count int; v_active text;
        v_floor int; v_ratio numeric; v_target int; v_avg numeric;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF NOT EXISTS (SELECT 1 FROM factions WHERE id = p_faction_id AND retired = false) THEN
    RETURN json_build_object('error','not_found'); END IF;
  IF EXISTS (SELECT 1 FROM faction_members WHERE faction_id = p_faction_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error','already_member'); END IF;

  v_max := COALESCE((SELECT value::int FROM app_settings WHERE key = 'faction_max_count'), 2);
  SELECT count(*) INTO v_count
  FROM faction_members m JOIN factions f ON f.id = m.faction_id
  WHERE m.user_id = p_user_id AND f.retired = false;
  IF v_count >= v_max THEN RETURN json_build_object('error','too_many'); END IF;

  -- Lock soft : Compagnie trop peuplée
  v_floor := COALESCE((SELECT value::int     FROM app_settings WHERE key = 'faction_lock_floor'), 8);
  v_ratio := COALESCE((SELECT value::numeric FROM app_settings WHERE key = 'faction_lock_ratio'), 4);
  SELECT count(*) INTO v_target FROM faction_members WHERE faction_id = p_faction_id;
  SELECT avg(c) INTO v_avg FROM (
    SELECT count(*) AS c FROM faction_members fm JOIN factions f ON f.id = fm.faction_id
    WHERE f.retired = false GROUP BY fm.faction_id
  ) s;
  IF v_target >= v_floor AND v_avg IS NOT NULL AND v_target >= v_ratio * v_avg THEN
    RETURN json_build_object('error','faction_full');
  END IF;

  INSERT INTO faction_members (faction_id, user_id) VALUES (p_faction_id, p_user_id);
  SELECT faction_id INTO v_active FROM users WHERE id = p_user_id;
  IF v_active IS NULL THEN
    UPDATE users SET faction_id = p_faction_id WHERE id = p_user_id;
    v_active := p_faction_id;
  END IF;

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