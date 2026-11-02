-- 579 — Les anecdotes d'un motif : on les gagne en scannant
--
-- WHY : Uriel, 02/11/2026 — spec docs/superpowers/specs/2026-11-02-codex-design.md.
--   · Chaque scan d'un motif donne une anecdote, gratuite une fois par motif et par jour (fuseau de
--     Paris) ; « Creuser encore » en tire une de plus pour 2 énergies, tant que la jauge le permet.
--     Le Porteur aussi gagne les siennes en scannant (son propre t-shirt compte).
--   · Le tirage se fait parmi les anecdotes visibles pas encore trouvées, pondéré par la rareté
--     (commune 60, peu commune 30, rare 10), sur les raretés qui restent.
--   · Le serveur décide de tout : un faux scan ne rapporte qu'une anecdote par jour et par motif.
--   · Les anecdotes s'écrivent au Hub (la boutique ne les montre pas), comme les énigmes.
--   mon_fragment repart de sa définition de la 578 (live du 02/11) et rend en plus les anecdotes
--   trouvées et ce qui reste.
--
-- SCHEMA CHECKED (02/11/2026, live) : title_fragments(id, visible) ; users(id, energy_points
--   numeric) ; scans(fragment_id, user_id, quand) ; get_user_energy(text) recharge l'énergie avant
--   une dépense (motif de decouvrir_lieu, mig 401) ; _is_admin(), _refus(text, text).

CREATE TABLE IF NOT EXISTS public.anecdotes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fragment_id integer NOT NULL REFERENCES public.title_fragments(id) ON DELETE CASCADE,
  texte text NOT NULL CHECK (btrim(texte) <> ''),
  rarete text NOT NULL CHECK (rarete IN ('commune', 'peu_commune', 'rare')),
  visible boolean NOT NULL DEFAULT true,
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS anecdotes_fragment ON public.anecdotes (fragment_id);
ALTER TABLE public.anecdotes ENABLE ROW LEVEL SECURITY; -- tout passe par les fonctions ci-dessous

CREATE TABLE IF NOT EXISTS public.anecdotes_trouvees (
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  anecdote_id bigint NOT NULL REFERENCES public.anecdotes(id) ON DELETE CASCADE,
  quand timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, anecdote_id)
);
ALTER TABLE public.anecdotes_trouvees ENABLE ROW LEVEL SECURITY;

-- Tirer une anecdote ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tirer_anecdote(p_fragment integer, p_creuser boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_moi text := auth.uid()::text;
  v_aujourdhui date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_premiere boolean;
  v_rarete text;
  v_id bigint;
  v_texte text;
  v_raison text;
  v_points numeric;
BEGIN
  IF v_moi IS NULL THEN PERFORM _refus('Connecte-toi pour garder tes anecdotes', 'auth'); END IF;
  IF NOT EXISTS (SELECT 1 FROM title_fragments WHERE id = p_fragment AND visible) THEN
    PERFORM _refus('Fragment introuvable', 'fragment');
  END IF;

  -- Le premier scan de ce motif par moi : l'appli joue la découverte.
  v_premiere := (SELECT count(*) FROM scans WHERE user_id = v_moi AND fragment_id = p_fragment) <= 1;

  -- La rareté d'abord, pondérée parmi celles qui restent ; puis une anecdote de cette rareté.
  SELECT r.rarete INTO v_rarete
  FROM (
    SELECT DISTINCT a.rarete,
           CASE a.rarete WHEN 'commune' THEN 60 WHEN 'peu_commune' THEN 30 ELSE 10 END AS poids
    FROM anecdotes a
    WHERE a.fragment_id = p_fragment AND a.visible
      AND NOT EXISTS (SELECT 1 FROM anecdotes_trouvees t WHERE t.user_id = v_moi AND t.anecdote_id = a.id)
  ) r
  ORDER BY -ln(1 - random()) / r.poids  -- tirage pondéré (méthode exponentielle)
  LIMIT 1;

  IF v_rarete IS NULL THEN
    v_raison := 'toutes_trouvees';
  ELSIF NOT p_creuser THEN
    IF EXISTS (
      SELECT 1 FROM anecdotes_trouvees t JOIN anecdotes a ON a.id = t.anecdote_id
      WHERE t.user_id = v_moi AND a.fragment_id = p_fragment
        AND (t.quand AT TIME ZONE 'Europe/Paris')::date = v_aujourdhui
    ) THEN
      v_raison := 'deja_aujourdhui';
    ELSE
      v_raison := 'gratuite';
    END IF;
  ELSE
    PERFORM 1 FROM users WHERE id = v_moi FOR UPDATE; -- deux « Creuser » rapprochés : l'un attend l'autre
    PERFORM public.get_user_energy(v_moi); -- la recharge d'abord
    SELECT energy_points INTO v_points FROM users WHERE id = v_moi;
    IF v_points < 2 THEN
      RAISE EXCEPTION 'Pas assez d''énergie' USING ERRCODE = 'RDC01';
    END IF;
    UPDATE users SET energy_points = energy_points - 2 WHERE id = v_moi;
    v_raison := 'creusee';
  END IF;

  IF v_raison IN ('gratuite', 'creusee') THEN
    SELECT a.id, a.texte INTO v_id, v_texte
    FROM anecdotes a
    WHERE a.fragment_id = p_fragment AND a.visible AND a.rarete = v_rarete
      AND NOT EXISTS (SELECT 1 FROM anecdotes_trouvees t WHERE t.user_id = v_moi AND t.anecdote_id = a.id)
    ORDER BY random()
    LIMIT 1;
    INSERT INTO anecdotes_trouvees (user_id, anecdote_id) VALUES (v_moi, v_id);
  END IF;

  RETURN jsonb_build_object(
    'anecdote', CASE WHEN v_id IS NULL THEN NULL
                     ELSE jsonb_build_object('id', v_id, 'texte', v_texte, 'rarete', v_rarete) END,
    'raison', v_raison,
    'restantes', (SELECT count(*) FROM anecdotes a WHERE a.fragment_id = p_fragment AND a.visible
                    AND NOT EXISTS (SELECT 1 FROM anecdotes_trouvees t WHERE t.user_id = v_moi AND t.anecdote_id = a.id)),
    'raresRestantes', (SELECT count(*) FROM anecdotes a WHERE a.fragment_id = p_fragment AND a.visible AND a.rarete = 'rare'
                    AND NOT EXISTS (SELECT 1 FROM anecdotes_trouvees t WHERE t.user_id = v_moi AND t.anecdote_id = a.id)),
    'premiereDecouverte', v_premiere
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.tirer_anecdote(integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tirer_anecdote(integer, boolean) TO authenticated;

-- mon_fragment rend les anecdotes trouvées (définition de la 578 + 3 clés) -----------------------

CREATE OR REPLACE FUNCTION public.mon_fragment(p_id integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_moi text := auth.uid()::text;
  v_numero integer;
  v_scans integer;
BEGIN
  IF v_moi IS NULL THEN PERFORM _refus('Connecte-toi pour ouvrir ton Codex', 'auth'); END IF;
  IF NOT EXISTS (SELECT 1 FROM title_fragments WHERE id = p_id AND visible) THEN RETURN NULL; END IF;

  SELECT numero INTO v_numero FROM user_fragments WHERE user_id = v_moi AND fragment_id = p_id;
  SELECT scans INTO v_scans FROM _mes_scans(v_moi) WHERE fragment_id = p_id;

  RETURN jsonb_build_object(
    'etat', CASE WHEN v_numero IS NOT NULL THEN 'porte'
                 WHEN v_scans IS NOT NULL THEN 'scanne' ELSE 'inconnu' END,
    'scans', coalesce(v_scans, 0),
    'numero', v_numero,
    'porteurs', (SELECT count(*) FROM user_fragments WHERE fragment_id = p_id),
    'signe', EXISTS (SELECT 1 FROM users WHERE id = v_moi AND signe_fragment_id = p_id),
    'anecdotes', coalesce((
      SELECT jsonb_agg(jsonb_build_object('texte', a.texte, 'rarete', a.rarete) ORDER BY t.quand DESC)
      FROM anecdotes_trouvees t JOIN anecdotes a ON a.id = t.anecdote_id
      WHERE t.user_id = v_moi AND a.fragment_id = p_id AND a.visible), '[]'::jsonb),
    'restantes', (SELECT count(*) FROM anecdotes a WHERE a.fragment_id = p_id AND a.visible
                    AND NOT EXISTS (SELECT 1 FROM anecdotes_trouvees t WHERE t.user_id = v_moi AND t.anecdote_id = a.id)),
    'raresRestantes', (SELECT count(*) FROM anecdotes a WHERE a.fragment_id = p_id AND a.visible AND a.rarete = 'rare'
                    AND NOT EXISTS (SELECT 1 FROM anecdotes_trouvees t WHERE t.user_id = v_moi AND t.anecdote_id = a.id))
  );
END $$;

-- Le Hub écrit les anecdotes ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.hub_anecdotes(p_fragment integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', a.id, 'texte', a.texte, 'rarete', a.rarete, 'visible', a.visible,
             'trouvee', (SELECT count(*) FROM anecdotes_trouvees t WHERE t.anecdote_id = a.id)
           ) ORDER BY a.cree_le)
    FROM anecdotes a WHERE a.fragment_id = p_fragment), '[]'::jsonb);
END $$;
REVOKE EXECUTE ON FUNCTION public.hub_anecdotes(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_anecdotes(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.hub_ecrire_anecdote(
  p_id bigint, p_fragment integer, p_texte text, p_rarete text, p_visible boolean)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_id bigint;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_id IS NULL THEN
    INSERT INTO anecdotes (fragment_id, texte, rarete, visible)
    VALUES (p_fragment, btrim(p_texte), p_rarete, p_visible)
    RETURNING id INTO v_id;
  ELSE
    UPDATE anecdotes SET texte = btrim(p_texte), rarete = p_rarete, visible = p_visible
    WHERE id = p_id AND fragment_id = p_fragment
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN PERFORM _refus('Anecdote introuvable', 'anecdote'); END IF;
  END IF;
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.hub_ecrire_anecdote(bigint, integer, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_ecrire_anecdote(bigint, integer, text, text, boolean) TO authenticated;
