-- 314_grades_libres_fix_check_and_govern_clamp.sql
-- WHY : revue finale grades libres.
-- C1 (bloquant) : la contrainte CHECK (rank BETWEEN 1 AND 4) de mig 306 empêchait de sauver
--   5 ou 6 grades → on l'élargit à 1..6.
-- I1 : set_faction_grades ne re-clampait govern_grades QUE pour le Chef → un gouvernant non-Chef
--   réduisant l'échelle pouvait laisser un seuil périmé qui inclut le catch-all. On re-clampe TOUJOURS
--   le seuil stocké à [1, N-1] (la VALEUR n'est changeable que par le Chef, mais le clamp s'applique
--   à tout enregistrement). ADDITIF.

ALTER TABLE public.faction_grade_labels DROP CONSTRAINT IF EXISTS faction_grade_labels_rank_check;
ALTER TABLE public.faction_grade_labels ADD CONSTRAINT faction_grade_labels_rank_check CHECK (rank BETWEEN 1 AND 6);

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

  -- Seuil de gouvernance : la VALEUR n'est changeable que par le Chef (grade 1) ; mais on re-clampe
  -- TOUJOURS le seuil stocké à [1, N-1] pour qu'il n'inclue jamais le catch-all après un redimensionnement.
  UPDATE factions SET govern_grades = LEAST(GREATEST(
    CASE WHEN v_rank = 1 AND p_govern_grades IS NOT NULL THEN p_govern_grades ELSE govern_grades END, 1), v_n - 1)
  WHERE id = p_faction_id;

  RETURN json_build_object('success', true);
END;$$;
GRANT EXECUTE ON FUNCTION public.set_faction_grades(text,jsonb,int) TO authenticated, service_role;
