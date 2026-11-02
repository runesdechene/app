-- 578 — Le Codex d'un Explorateur : sa collection et l'état d'un Fragment
--
-- WHY : Uriel, 02/11/2026 — le Codex (spec docs/superpowers/specs/2026-11-02-codex-design.md).
--   mon_codex rend toute la collection, rangée par collection thématique (heritage), avec l'état
--   de chaque Fragment pour l'Explorateur connecté : inconnu, scanné ou porté. mon_fragment rend
--   l'état d'un seul Fragment pour sa fiche. Le contenu du motif, lui, reste dans recit_du_fragment.
--   Deux scans du même motif à moins d'une minute ne comptent que pour un (le scanner bipe en rafale).
--   Un Fragment masqué (visible = false) n'existe pas pour le Codex.
--
-- SCHEMA CHECKED (02/11/2026, live) : title_fragments(id, name, illustration_url, heritage,
--   visible, created_at, edition, edition_precision) ; user_fragments(user_id, fragment_id, numero) ;
--   scans(fragment_id, user_id, quand) ; codex_collections(heritage, couleur, icone_url, titre) ;
--   users(id, signe_fragment_id).

-- Mes scans comptés : un par minute et par motif.
CREATE OR REPLACE FUNCTION public._mes_scans(p_user text)
RETURNS TABLE (fragment_id integer, scans integer)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT fragment_id, count(*)::int
  FROM (
    SELECT fragment_id, quand,
           lag(quand) OVER (PARTITION BY fragment_id ORDER BY quand) AS precedent
    FROM scans WHERE user_id = p_user
  ) s
  WHERE precedent IS NULL OR quand - precedent >= interval '1 minute'
  GROUP BY fragment_id;
$$;
REVOKE EXECUTE ON FUNCTION public._mes_scans(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mon_codex()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_moi text := auth.uid()::text;
  v_resultat jsonb;
BEGIN
  IF v_moi IS NULL THEN PERFORM _refus('Connecte-toi pour ouvrir ton Codex', 'auth'); END IF;

  WITH etats AS (
    SELECT f.id, f.name, f.illustration_url, f.heritage, f.edition, f.edition_precision,
           f.created_at > now() - interval '60 days' AS nouveau,
           uf.numero,
           coalesce(s.scans, 0) AS scans,
           CASE WHEN uf.user_id IS NOT NULL THEN 'porte'
                WHEN s.scans IS NOT NULL THEN 'scanne'
                ELSE 'inconnu' END AS etat
    FROM title_fragments f
    LEFT JOIN user_fragments uf ON uf.fragment_id = f.id AND uf.user_id = v_moi
    LEFT JOIN _mes_scans(v_moi) s ON s.fragment_id = f.id
    WHERE f.visible
  ),
  collections AS (
    SELECT e.heritage,
           count(*) FILTER (WHERE e.etat = 'porte') AS portes,
           count(*) AS total,
           jsonb_agg(jsonb_build_object(
             'id', e.id, 'nom', e.name, 'illustration', e.illustration_url, 'etat', e.etat,
             'scans', e.scans, 'numero', e.numero, 'nouveau', e.nouveau,
             'edition', e.edition, 'editionPrecision', e.edition_precision
           ) ORDER BY e.name) AS fragments
    FROM etats e
    GROUP BY e.heritage
  )
  SELECT jsonb_build_object(
    'totaux', (SELECT jsonb_build_object(
                 'portes', count(*) FILTER (WHERE etat = 'porte'),
                 'scannes', count(*) FILTER (WHERE etat = 'scanne'),
                 'inconnus', count(*) FILTER (WHERE etat = 'inconnu'),
                 'total', count(*)) FROM etats),
    'collections', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'heritage', c.heritage, 'couleur', cc.couleur, 'icone', cc.icone_url,
               'titre', cc.titre, 'portes', c.portes, 'total', c.total, 'fragments', c.fragments
             ) ORDER BY c.heritage NULLS LAST)
      FROM collections c LEFT JOIN codex_collections cc ON cc.heritage = c.heritage), '[]'::jsonb)
  ) INTO v_resultat;

  RETURN v_resultat;
END $$;
REVOKE EXECUTE ON FUNCTION public.mon_codex() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mon_codex() TO authenticated;

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
    'signe', EXISTS (SELECT 1 FROM users WHERE id = v_moi AND signe_fragment_id = p_id)
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.mon_fragment(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mon_fragment(integer) TO authenticated;
