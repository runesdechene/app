-- 313_grades_libres_write_and_powers.sql
-- WHY : écriture de la structure de grades (remplace set_faction_grade_labels) + gates alignés sur
-- le seuil govern_grades (éditer identité/grades, inviter, exclure). Suppression = Chef (grade 1).
-- ADDITIF. Corps des 3 RPC re-gatées = baselines (308 update_identity, 270 remove_member, 290 delete),
-- seul le contrôle d'accès change.

-- ── Écriture de la structure complète (libellés + capacités + seuil) ──
CREATE OR REPLACE FUNCTION public.set_faction_grades(p_faction_id text, p_grades jsonb, p_govern_grades int)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid text := auth.uid()::text; v_rank int; v_govern int; v_n int; v_idx int := 0; v_row jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN json_build_object('error','unauthorized'); END IF;
  v_rank := public._member_grade_rank(v_uid, p_faction_id);
  SELECT govern_grades INTO v_govern FROM factions WHERE id = p_faction_id;
  IF v_rank IS NULL OR v_rank > COALESCE(v_govern, 2) THEN RETURN json_build_object('error','not_governing'); END IF;

  v_n := jsonb_array_length(p_grades);
  IF v_n IS NULL OR v_n < 2 OR v_n > 6 THEN RETURN json_build_object('error','bad_grade_count'); END IF;

  DELETE FROM faction_grade_labels WHERE faction_id = p_faction_id;
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_grades) LOOP
    v_idx := v_idx + 1;
    INSERT INTO faction_grade_labels(faction_id, rank, label_m, label_f, label_n, capacity) VALUES (
      p_faction_id, v_idx,
      LEFT(btrim(COALESCE(v_row->>'label_m','')), 30),
      LEFT(btrim(COALESCE(v_row->>'label_f', v_row->>'label_m','')), 30),
      NULLIF(LEFT(btrim(COALESCE(v_row->>'label_n','')), 30), ''),
      CASE WHEN v_idx = v_n THEN NULL ELSE GREATEST(1, COALESCE((v_row->>'capacity')::int, 1)) END
    );
  END LOOP;

  -- seuil de gouvernance : seulement le Chef (grade 1) peut le changer ; clamp [1, n-1]
  IF v_rank = 1 AND p_govern_grades IS NOT NULL THEN
    UPDATE factions SET govern_grades = LEAST(GREATEST(p_govern_grades, 1), v_n - 1) WHERE id = p_faction_id;
  END IF;
  RETURN json_build_object('success', true);
END;$$;
GRANT EXECUTE ON FUNCTION public.set_faction_grades(text,jsonb,int) TO authenticated, service_role;

-- ── update_faction_identity : gate ≤ govern_grades (corps = baseline 308) ──
CREATE OR REPLACE FUNCTION public.update_faction_identity(
  p_user_id text, p_faction_id text, p_name text, p_color text, p_description text, p_image_url text,
  p_tags text[] DEFAULT '{}', p_emblem_icon text DEFAULT NULL, p_emblem_mono text DEFAULT 'none'
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_name text; v_tags text[]; v_mono text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF COALESCE(public._member_grade_rank(p_user_id, p_faction_id), 99)
     > COALESCE((SELECT govern_grades FROM factions WHERE id = p_faction_id), 2)
  THEN RETURN json_build_object('error','not_governing'); END IF;
  v_name := btrim(coalesce(p_name,''));
  IF v_name = ''         THEN RETURN json_build_object('error','name_required'); END IF;
  IF length(v_name) > 40 THEN RETURN json_build_object('error','name_too_long'); END IF;
  IF EXISTS (SELECT 1 FROM factions WHERE lower(title) = lower(v_name) AND id <> p_faction_id AND retired = false) THEN
    RETURN json_build_object('error','name_taken'); END IF;

  v_tags := COALESCE((SELECT array_agg(x) FROM (
    SELECT btrim(t) AS x FROM unnest(p_tags) t WHERE btrim(t) <> '' AND length(btrim(t)) <= 24 LIMIT 6
  ) s), '{}');
  v_mono := CASE WHEN p_emblem_mono IN ('none','white','black') THEN p_emblem_mono ELSE 'none' END;

  UPDATE factions SET
    title = v_name,
    color = COALESCE(NULLIF(btrim(p_color),''), color),
    description = NULLIF(btrim(p_description),''),
    image_url = NULLIF(btrim(p_image_url),''),
    tags = v_tags,
    emblem_icon = NULLIF(btrim(coalesce(p_emblem_icon,'')),''),
    emblem_mono = v_mono,
    updated_at = now()
  WHERE id = p_faction_id;
  RETURN json_build_object('success', true);
END;$$;
GRANT EXECUTE ON FUNCTION public.update_faction_identity(text,text,text,text,text,text,text[],text,text) TO authenticated, service_role;

-- ── remove_faction_member : gate ≤ govern_grades (corps = baseline 270) ──
CREATE OR REPLACE FUNCTION public.remove_faction_member(p_user_id text, p_faction_id text, p_target_user_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF p_target_user_id = p_user_id THEN RETURN json_build_object('error','cannot_remove_self'); END IF;
  IF COALESCE(public._member_grade_rank(p_user_id, p_faction_id), 99)
     > COALESCE((SELECT govern_grades FROM factions WHERE id = p_faction_id), 2)
  THEN RETURN json_build_object('error','not_governing'); END IF;
  IF NOT EXISTS (SELECT 1 FROM faction_members WHERE faction_id = p_faction_id AND user_id = p_target_user_id) THEN
    RETURN json_build_object('error','not_member'); END IF;

  DELETE FROM faction_members WHERE faction_id = p_faction_id AND user_id = p_target_user_id;
  UPDATE users SET faction_id = (
    SELECT faction_id FROM faction_members WHERE user_id = p_target_user_id ORDER BY joined_at LIMIT 1
  ) WHERE id = p_target_user_id AND faction_id = p_faction_id;
  RETURN json_build_object('success', true);
END;$$;
GRANT EXECUTE ON FUNCTION public.remove_faction_member(text,text,text) TO authenticated, service_role;

-- ── delete_faction : gate Chef (grade 1) au lieu du fondateur (corps = baseline 290) ──
CREATE OR REPLACE FUNCTION public.delete_faction(p_user_id text, p_faction_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_creator text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN RETURN json_build_object('error','unauthorized'); END IF;
  SELECT created_by INTO v_creator FROM factions WHERE id = p_faction_id AND retired = false;
  IF NOT FOUND THEN RETURN json_build_object('error','not_found'); END IF;
  IF v_creator IS NULL THEN RETURN json_build_object('error','official_no_delete'); END IF;  -- officielle non supprimable
  IF COALESCE(public._member_grade_rank(p_user_id, p_faction_id), 99) <> 1 THEN
    RETURN json_build_object('error','not_chef'); END IF;

  UPDATE place_veille SET faction_id = NULL WHERE faction_id = p_faction_id;
  UPDATE users u SET faction_id = (
    SELECT fm.faction_id FROM faction_members fm
    JOIN factions f ON f.id = fm.faction_id
    WHERE fm.user_id = u.id AND fm.faction_id <> p_faction_id AND f.retired = false
    ORDER BY fm.joined_at LIMIT 1
  ) WHERE u.faction_id = p_faction_id;
  DELETE FROM faction_members WHERE faction_id = p_faction_id;
  UPDATE factions SET retired = true, updated_at = now() WHERE id = p_faction_id;
  RETURN json_build_object('success', true);
END;$$;
GRANT EXECUTE ON FUNCTION public.delete_faction(text,text) TO authenticated, service_role;
