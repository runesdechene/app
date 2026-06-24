-- 292_faction_lock_vs_others.sql
-- WHY : le lock comparait à la moyenne INCLUANT la grosse Compagnie (le gros tire la
-- moyenne vers le haut → seuil instable, ne se déclenchait pas). On compare désormais au
-- « rapport différentiel vs les AUTRES Compagnies » (intention initiale d'Uriel : ×4/×5).
-- Centralisé dans _faction_is_locked, utilisé par join_faction (serveur), list_factions
-- et get_faction_detail (affichage). Ratio remis à ×4. ADDITIF.

UPDATE public.app_settings SET value='4' WHERE key='faction_lock_ratio';

CREATE OR REPLACE FUNCTION public._faction_is_locked(p_faction_id text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  WITH counts AS (
    SELECT fm.faction_id, count(*)::numeric AS c
    FROM public.faction_members fm JOIN public.factions f ON f.id = fm.faction_id
    WHERE f.retired = false GROUP BY fm.faction_id
  )
  SELECT COALESCE(
    (SELECT t.c FROM counts t WHERE t.faction_id = p_faction_id)
       >= COALESCE((SELECT value::numeric FROM public.app_settings WHERE key='faction_lock_floor'), 8)
    AND (SELECT count(*) FROM counts WHERE faction_id <> p_faction_id) > 0
    AND (SELECT t.c FROM counts t WHERE t.faction_id = p_faction_id)
        >= COALESCE((SELECT value::numeric FROM public.app_settings WHERE key='faction_lock_ratio'), 4)
           * (SELECT avg(c) FROM counts WHERE faction_id <> p_faction_id)
  , false);
$$;
GRANT EXECUTE ON FUNCTION public._faction_is_locked(text) TO authenticated, anon, service_role;

-- join_faction, list_factions, get_faction_detail : lock via le helper
-- (corps complets appliqués en prod — voir migration ; identiques à 291 sauf la partie lock
--  qui appelle public._faction_is_locked).
-- join_faction
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
  SELECT count(*) INTO v_count FROM faction_members m JOIN factions f ON f.id = m.faction_id
  WHERE m.user_id = p_user_id AND f.retired = false;
  IF v_count >= v_max THEN RETURN json_build_object('error','too_many'); END IF;
  IF public._faction_is_locked(p_faction_id) THEN RETURN json_build_object('error','faction_full'); END IF;
  INSERT INTO faction_members (faction_id, user_id) VALUES (p_faction_id, p_user_id);
  SELECT faction_id INTO v_active FROM users WHERE id = p_user_id;
  IF v_active IS NULL THEN UPDATE users SET faction_id = p_faction_id WHERE id = p_user_id; v_active := p_faction_id; END IF;
  INSERT INTO activity_log (type, actor_id, faction_id, data)
  SELECT 'faction_join', p_user_id, p_faction_id,
         jsonb_build_object('actorName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
           'factionTitle', f.title, 'factionColor', f.color, 'factionPattern', f.pattern)
  FROM users u, factions f WHERE u.id = p_user_id AND f.id = p_faction_id;
  RETURN json_build_object('success', true, 'activeFactionId', v_active);
END;$$;

-- NB : list_factions (locked via helper) et get_faction_detail (locked via helper) sont
-- redéfinies en prod avec leurs corps complets de la mig 291, en remplaçant uniquement le
-- calcul de `locked` par public._faction_is_locked(...). (Voir l'état prod / mig 291 pour
-- le corps intégral ; seul le terme locked change.)
