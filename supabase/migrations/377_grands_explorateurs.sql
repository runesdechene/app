-- WHY: « Les Grands Explorateurs » de l'Accueil (maquette 275:128, validée par Uriel le 28/09) :
--      ceux qui ont le plus marché ce mois-ci. Revient sur la spec V2 §5 (pas de classement de
--      personnes) : le compteur repart à zéro chaque mois, pour que tout le monde puisse y entrer.
--      On compte les lieux visités en GPS (place_explorers) depuis le 1er du mois, heure de Paris ;
--      lieux masqués ou privés exclus. À égalité, passe devant qui y est arrivé le premier.
--      Rend les dix premiers (le nom, le portrait, le niveau et le premier titre porté, comme le
--      profil — mig 362) et ma place : mon rang, mes lieux, et ceux du dixième pour dire ce qui
--      me manque. Aucune donnée qui ne soit déjà publique sur un profil.
-- SCHEMA CHECKED (29/09/2026) : place_explorers(place_id, user_id, visited_at) ; places(id,
--      masked, private) ; users(id, display_name, first_name, avatar_url, xp_total,
--      displayed_title_ids_v3) ; titles(id, name, type) ; _level_from_xp(int) ;
--      user_public_name(text, text, text).

CREATE OR REPLACE FUNCTION public.grands_explorateurs()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH moi AS (SELECT (auth.uid())::text AS id),
  debut AS (SELECT date_trunc('month', now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris' AS t),
  marche AS (
    SELECT e.user_id, count(*) AS lieux, max(e.visited_at) AS dernier
    FROM place_explorers e
    JOIN places p ON p.id = e.place_id
    CROSS JOIN debut
    WHERE e.visited_at >= debut.t AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
    GROUP BY e.user_id
  ),
  classes AS (
    SELECT m.*, row_number() OVER (ORDER BY m.lieux DESC, m.dernier ASC, m.user_id) AS rang
    FROM marche m
  )
  SELECT json_build_object(
    'tete', COALESCE((
      SELECT json_agg(json_build_object(
          'rang', c.rang,
          'id', u.id,
          'nom', user_public_name(u.id, u.display_name, u.first_name),
          'avatar', u.avatar_url,
          'niveau', public._level_from_xp(COALESCE(u.xp_total, 0)),
          'titre', (SELECT t.name
                    FROM unnest(u.displayed_title_ids_v3) WITH ORDINALITY AS x(tid, ord)
                    JOIN public.titles t ON t.id = x.tid AND t.type = 'general'
                    ORDER BY x.ord LIMIT 1),
          'lieux', c.lieux)
        ORDER BY c.rang)
      FROM classes c JOIN users u ON u.id = c.user_id
      WHERE c.rang <= 10), '[]'::json),
    'moi', (SELECT json_build_object('rang', c.rang, 'lieux', c.lieux)
            FROM classes c, moi WHERE c.user_id = moi.id),
    'dixieme', (SELECT c.lieux FROM classes c WHERE c.rang = 10));
$$;
REVOKE ALL ON FUNCTION public.grands_explorateurs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grands_explorateurs() TO authenticated;
