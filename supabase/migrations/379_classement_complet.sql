-- WHY: « Voir tout le classement » ouvre une page dans le tiroir (Uriel, 29/09) : « tout » veut
--      dire plus que dix. La tête passe aux cinquante premiers ; l'Accueil n'en montre que cinq.
--      « dixieme » reste le seuil des dix, que la ligne « Toi » vise.
-- SCHEMA CHECKED: grands_explorateurs(text, text) copiée de la définition live (mig 378,
--      appliquée le 29/09) ; seule la limite de la tête change (10 → 50).

CREATE OR REPLACE FUNCTION public.grands_explorateurs(p_type text DEFAULT 'visites', p_periode text DEFAULT 'mois')
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_debut timestamptz;
BEGIN
  IF p_type NOT IN ('visites', 'ajouts') OR p_periode NOT IN ('mois', 'toujours') THEN
    RAISE EXCEPTION 'Classement inconnu' USING ERRCODE = '22023';
  END IF;
  v_debut := CASE WHEN p_periode = 'mois'
    THEN date_trunc('month', now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris'
    ELSE '-infinity'::timestamptz END;

  RETURN (
    WITH moi AS (SELECT (auth.uid())::text AS id),
    actes AS (
      SELECT e.user_id, e.visited_at AS quand
      FROM place_explorers e JOIN places p ON p.id = e.place_id
      WHERE p_type = 'visites' AND e.visited_at >= v_debut
        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
      UNION ALL
      SELECT p.author_id, p.created_at
      FROM places p
      WHERE p_type = 'ajouts' AND p.author_id IS NOT NULL AND p.created_at >= v_debut
        AND p.nature = 'lieu' AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
    ),
    comptes AS (
      SELECT a.user_id, count(*) AS lieux, max(a.quand) AS dernier FROM actes a GROUP BY a.user_id
    ),
    classes AS (
      SELECT c.*, row_number() OVER (ORDER BY c.lieux DESC, c.dernier ASC, c.user_id) AS rang
      FROM comptes c
    ),
    fiches AS (
      SELECT c.rang, c.lieux, json_build_object(
          'rang', c.rang,
          'id', u.id,
          'nom', user_public_name(u.id, u.display_name, u.first_name),
          'avatar', u.avatar_url,
          'niveau', public._level_from_xp(COALESCE(u.xp_total, 0)),
          'titre', (SELECT t.name
                    FROM unnest(u.displayed_title_ids_v3) WITH ORDINALITY AS x(tid, ord)
                    JOIN public.titles t ON t.id = x.tid AND t.type = 'general'
                    ORDER BY x.ord LIMIT 1),
          'lieux', c.lieux) AS fiche, u.id AS user_id
      FROM classes c JOIN users u ON u.id = c.user_id
    )
    SELECT json_build_object(
      'tete', COALESCE((SELECT json_agg(f.fiche ORDER BY f.rang) FROM fiches f WHERE f.rang <= 50), '[]'::json),
      -- Ma place : ma fiche si je suis classé ; sinon mon nom et mon portrait, sans rang.
      'moi', COALESCE(
        (SELECT f.fiche FROM fiches f, moi WHERE f.user_id = moi.id),
        (SELECT json_build_object(
            'rang', NULL, 'id', u.id,
            'nom', user_public_name(u.id, u.display_name, u.first_name),
            'avatar', u.avatar_url,
            'niveau', public._level_from_xp(COALESCE(u.xp_total, 0)),
            'titre', NULL, 'lieux', 0)
          FROM users u, moi WHERE u.id = moi.id)),
      'dixieme', (SELECT c.lieux FROM classes c WHERE c.rang = 10))
  );
END;
$$;
REVOKE ALL ON FUNCTION public.grands_explorateurs(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grands_explorateurs(text, text) TO authenticated;
