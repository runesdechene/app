-- 306_faction_grade_labels.sql
-- WHY : grades des Compagnies. Le grade = position du membre dans le classement de la Compagnie.
-- 1er=Seigneur, 2e=Co-seigneur, 3-5=Officier, reste=Membre, allié=aucun. Classement = mérite Coupe
-- saison + investissement de fondation (PLEIN, compte chaque saison — décision Uriel 25/06 : le
-- fondateur garde son avance, qui s'érode si un membre le dépasse en mérite réel) + conquis ÷10.
-- _faction_chef = MÊME ordre (Seigneur = Chef). Libellés personnalisables (surcharges stockées ici),
-- sinon fallback thème Noblesse codé en dur (zéro seeding/backfill). ADDITIF (redéf. backward-compatibles).

CREATE TABLE IF NOT EXISTS public.faction_grade_labels (
  faction_id text NOT NULL REFERENCES public.factions(id) ON DELETE CASCADE,
  rank       int  NOT NULL CHECK (rank BETWEEN 1 AND 4),
  label_m    text NOT NULL,
  label_f    text NOT NULL,
  label_n    text,
  PRIMARY KEY (faction_id, rank)
);
ALTER TABLE public.faction_grade_labels ENABLE ROW LEVEL SECURITY;
-- Lecture publique (les libellés sont du contenu affiché à tous) ; écriture via RPC SECURITY DEFINER only.
DROP POLICY IF EXISTS faction_grade_labels_read ON public.faction_grade_labels;
CREATE POLICY faction_grade_labels_read ON public.faction_grade_labels FOR SELECT USING (true);

-- ── Libellé résolu : surcharge custom sinon fallback Noblesse. NULL si rang NULL (allié). ──
CREATE OR REPLACE FUNCTION public._grade_label(p_faction_id text, p_rank int, p_gender text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_rank IS NULL THEN NULL ELSE COALESCE(
    (SELECT CASE COALESCE(p_gender,'m')
              WHEN 'f' THEN label_f
              WHEN 'n' THEN COALESCE(label_n, label_m)
              ELSE label_m END
       FROM public.faction_grade_labels
       WHERE faction_id = p_faction_id AND rank = p_rank),
    CASE p_rank
      WHEN 1 THEN CASE COALESCE(p_gender,'m') WHEN 'f' THEN 'Dame'    WHEN 'n' THEN 'Seigneur·e'    ELSE 'Seigneur'    END
      WHEN 2 THEN CASE COALESCE(p_gender,'m') WHEN 'f' THEN 'Co-dame' WHEN 'n' THEN 'Co-seigneur·e' ELSE 'Co-seigneur' END
      WHEN 3 THEN CASE COALESCE(p_gender,'m') WHEN 'f' THEN 'Officière' WHEN 'n' THEN 'Officier·ère' ELSE 'Officier' END
      ELSE 'Membre'
    END
  ) END;
$$;

-- ── Rang de grade d'un membre (1..4), NULL si allié/non-membre. ──
-- Ordre = Coupe saison + investissement de fondation (plein) + conquis ÷10.
CREATE OR REPLACE FUNCTION public._member_grade_rank(p_user_id text, p_faction_id text)
RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_from timestamptz; v_to timestamptz; v_pos int;
BEGIN
  -- allié (2e adhésion) ou non-membre principal → aucun grade
  IF NOT EXISTS (
    SELECT 1 FROM faction_members m JOIN users u ON u.id = m.user_id
    WHERE m.faction_id = p_faction_id AND m.user_id = p_user_id
      AND u.faction_id = p_faction_id
  ) THEN RETURN NULL; END IF;

  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;

  SELECT pos INTO v_pos FROM (
    SELECT m.user_id,
      ROW_NUMBER() OVER (ORDER BY (
        public._user_faction_coupe(m.user_id, p_faction_id, v_from, v_to)
        + m.crowns_invested
        + m.crowns_conquered / 10.0
      ) DESC, m.joined_at ASC) AS pos
    FROM faction_members m JOIN users u ON u.id = m.user_id
    WHERE m.faction_id = p_faction_id AND u.faction_id = p_faction_id   -- principaux seulement
  ) ranked
  WHERE ranked.user_id = p_user_id;

  RETURN CASE WHEN v_pos = 1 THEN 1 WHEN v_pos = 2 THEN 2 WHEN v_pos <= 5 THEN 3 ELSE 4 END;
END;$$;

-- ── _faction_chef = MÊME ordre (= baseline mig 302). Seigneur = Chef. ──
CREATE OR REPLACE FUNCTION public._faction_chef(p_faction_id text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_from timestamptz; v_to timestamptz; v_chef text;
BEGIN
  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;
  SELECT m.user_id INTO v_chef
  FROM faction_members m JOIN users u ON u.id = m.user_id
  WHERE m.faction_id = p_faction_id
    AND u.faction_id = p_faction_id          -- principale uniquement : l'allié ne règne pas
  ORDER BY (
    public._user_faction_coupe(m.user_id, p_faction_id, v_from, v_to)
    + m.crowns_invested
    + m.crowns_conquered / 10.0
  ) DESC, m.joined_at ASC
  LIMIT 1;
  RETURN v_chef;
END;$$;

GRANT EXECUTE ON FUNCTION public._grade_label(text,int,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._member_grade_rank(text,text) TO authenticated, service_role;
