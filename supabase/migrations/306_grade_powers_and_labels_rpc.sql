-- 306_grade_powers_and_labels_rpc.sql
-- WHY : accorder les pouvoirs de gouvernance au top 5 (grade rang ≤ 3 = Seigneur+Co-seigneur+Officiers).
-- update_faction_identity passe de « Chef seul » à « gouvernance (rang ≤ 3) ». remove_faction_member
-- est LAISSÉ INTACT : il restreint déjà au Chef (= Seigneur = rang 1), ce qui est exactement la règle
-- voulue (exclusion = Seigneur seul). + RPC d'édition des libellés de grade personnalisés (rang ≤ 3).
-- ADDITIF (redéfinition backward-compatible, même signature ; nouvelle RPC).

-- ── Éditer l'identité : gouvernance (rang ≤ 3) au lieu de Chef seul ──
-- Corps = baseline mig 281, seul le contrôle d'accès change (not_chef → not_governing).
CREATE OR REPLACE FUNCTION public.update_faction_identity(
  p_user_id text, p_faction_id text, p_name text, p_color text, p_description text, p_image_url text,
  p_tags text[] DEFAULT '{}', p_emblem_icon text DEFAULT NULL, p_emblem_mono text DEFAULT 'none'
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_name text; v_tags text[]; v_mono text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF COALESCE(public._member_grade_rank(p_user_id, p_faction_id), 99) > 3 THEN RETURN json_build_object('error','not_governing'); END IF;
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

-- ── Éditer les libellés de grade (rang ≤ 3). p_labels = [{rank,label_m,label_f,label_n}] ──
CREATE OR REPLACE FUNCTION public.set_faction_grade_labels(p_faction_id text, p_labels jsonb)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid text := auth.uid()::text; v_row jsonb; v_rank int;
BEGIN
  IF v_uid IS NULL THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF COALESCE(public._member_grade_rank(v_uid, p_faction_id), 99) > 3 THEN
    RETURN json_build_object('error','not_governing'); END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_labels) LOOP
    v_rank := (v_row->>'rank')::int;
    IF v_rank IS NULL OR v_rank < 1 OR v_rank > 4 THEN CONTINUE; END IF;
    INSERT INTO public.faction_grade_labels(faction_id, rank, label_m, label_f, label_n)
    VALUES (
      p_faction_id, v_rank,
      LEFT(btrim(COALESCE(v_row->>'label_m','')), 30),
      LEFT(btrim(COALESCE(v_row->>'label_f', v_row->>'label_m','')), 30),
      NULLIF(LEFT(btrim(COALESCE(v_row->>'label_n','')), 30), '')
    )
    ON CONFLICT (faction_id, rank) DO UPDATE
      SET label_m = EXCLUDED.label_m, label_f = EXCLUDED.label_f, label_n = EXCLUDED.label_n;
  END LOOP;
  RETURN json_build_object('success', true);
END;$$;

GRANT EXECUTE ON FUNCTION public.set_faction_grade_labels(text,jsonb) TO authenticated, service_role;
