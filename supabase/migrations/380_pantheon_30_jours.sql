-- WHY: le classement devient « Le Panthéon » (Uriel, 29/09), sur les 30 derniers jours glissants
--      plutôt que depuis le 1er du mois : il n'est jamais vide le 1er au matin, et chacun y
--      reste un mois entier après ses marches. La période 'mois' devient '30jours' (valeur par
--      défaut) ; 'toujours' ne change pas.
-- SCHEMA CHECKED: grands_explorateurs(text, text) copiée de la définition de la mig 379 (elle-même
--      copie de la 378, live le 29/09) ; seuls la période et le défaut changent.

CREATE OR REPLACE FUNCTION public.grands_explorateurs(p_type text DEFAULT 'visites', p_periode text DEFAULT '30jours')
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_debut timestamptz;
BEGIN
  IF p_type NOT IN ('visites', 'ajouts') OR p_periode NOT IN ('30jours', 'toujours') THEN
    RAISE EXCEPTION 'Classement inconnu' USING ERRCODE = '22023';
  END IF;
  v_debut := CASE WHEN p_periode = '30jours' THEN now() - interval '30 days'
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
