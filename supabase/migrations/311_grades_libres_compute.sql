-- 311_grades_libres_compute.sql
-- WHY : grade d'un membre = parcours des capacités du haut sur sa position de classement.
-- Défaut (1/1/3/reste) si la Compagnie n'a aucune ligne custom (= comportement 25/06).
-- _grade_label (mig 306) inchangé : lit la ligne au rang demandé, fallback Noblesse si absente.
CREATE OR REPLACE FUNCTION public._member_grade_rank(p_user_id text, p_faction_id text)
RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_from timestamptz; v_to timestamptz; v_pos int; v_acc int := 0; v_n int; v_rec record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM faction_members m JOIN users u ON u.id = m.user_id
    WHERE m.faction_id = p_faction_id AND m.user_id = p_user_id AND u.faction_id = p_faction_id
  ) THEN RETURN NULL; END IF;

  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;

  SELECT pos INTO v_pos FROM (
    SELECT m.user_id, ROW_NUMBER() OVER (ORDER BY (
        public._user_faction_coupe(m.user_id, p_faction_id, v_from, v_to)
        + m.crowns_invested + m.crowns_conquered / 10.0) DESC, m.joined_at ASC) AS pos
    FROM faction_members m JOIN users u ON u.id = m.user_id
    WHERE m.faction_id = p_faction_id AND u.faction_id = p_faction_id
  ) ranked WHERE ranked.user_id = p_user_id;
  IF v_pos IS NULL THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_n FROM faction_grade_labels WHERE faction_id = p_faction_id;
  IF v_n = 0 THEN
    RETURN CASE WHEN v_pos = 1 THEN 1 WHEN v_pos = 2 THEN 2 WHEN v_pos <= 5 THEN 3 ELSE 4 END;
  END IF;

  FOR v_rec IN SELECT rank, capacity FROM faction_grade_labels WHERE faction_id = p_faction_id ORDER BY rank LOOP
    IF v_rec.capacity IS NULL THEN RETURN v_rec.rank; END IF;       -- catch-all
    v_acc := v_acc + v_rec.capacity;
    IF v_pos <= v_acc THEN RETURN v_rec.rank; END IF;
  END LOOP;
  RETURN v_n;  -- sécurité (pas de catch-all explicite)
END;$$;
GRANT EXECUTE ON FUNCTION public._member_grade_rank(text,text) TO authenticated, service_role;
