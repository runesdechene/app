-- WHY: le cœur posé sur « X a percé une énigme », dans « Sur les chemins », ne tenait pas (Uriel,
--      11/10). La ligne existe depuis la 449 (son événement : enigme:<qui>:<culture>:<jour>), mais
--      _auteur_du_chemin ne la connaissait pas : saluer levait « Introuvable » et l'appli retirait le
--      cœur posé d'avance.
--   _auteur_du_chemin (définition live du 11/10, copiée entière) : le cas 'enigme' — qui a percé
--   une énigme de cette culture ce jour-là, comme la ligne du fil (réponse juste, culture active).
-- SCHEMA CHECKED (11/10/2026, information_schema) : enigma_responses(user_id, enigma_id, correct,
--   responded_at) ; enigmas(id, theme) ; enigma_themes(id, active).

CREATE OR REPLACE FUNCTION public._auteur_du_chemin(p_evenement text)
 RETURNS character varying
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$



  SELECT CASE split_part(p_evenement, ':', 1)



    WHEN 'visite' THEN (



      SELECT e.user_id FROM place_explorers e JOIN places p ON p.id = e.place_id



      WHERE e.place_id = split_part(p_evenement, ':', 2) AND e.user_id = split_part(p_evenement, ':', 3)



        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1)



    WHEN 'ajout' THEN (



      SELECT p.author_id FROM places p



      WHERE p.id = split_part(p_evenement, ':', 2) AND p.masked IS NOT TRUE AND p.private IS NOT TRUE)



    WHEN 'arrivee' THEN (SELECT u.id FROM users u WHERE u.id = split_part(p_evenement, ':', 2))

    WHEN 'connexion' THEN (SELECT u.id FROM users u WHERE u.id = split_part(p_evenement, ':', 2))

    WHEN 'revendication' THEN COALESCE((

      SELECT h.user_id FROM veille_history h JOIN places p ON p.id = h.place_id

      WHERE h.place_id = split_part(p_evenement, ':', 2) AND h.user_id = split_part(p_evenement, ':', 3)

        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1), (

      -- 438 : ou dans le registre de la V2.

      SELECT r.user_id FROM revendications r JOIN places p ON p.id = r.place_id

      WHERE r.place_id = split_part(p_evenement, ':', 2) AND r.user_id = split_part(p_evenement, ':', 3)

        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1))

    -- 415 : enrichi ou modifié, l'auteur d'une version (versions_lieu, où la mig 416 a versé la V1).

    WHEN 'enrichi' THEN (

      SELECT v.auteur FROM versions_lieu v JOIN places p ON p.id = v.place_id

      WHERE v.place_id = split_part(p_evenement, ':', 2) AND v.auteur = split_part(p_evenement, ':', 3)

        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1)

    WHEN 'modifie' THEN (

      SELECT v.auteur FROM versions_lieu v JOIN places p ON p.id = v.place_id

      WHERE v.place_id = split_part(p_evenement, ':', 2) AND v.auteur = split_part(p_evenement, ':', 3)

        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1)

    -- 425 : fonder ou rejoindre une Compagnie publique, tant qu'on en est.

    WHEN 'fondation' THEN (

      SELECT m.user_id FROM faction_members m JOIN factions f ON f.id = m.faction_id

      WHERE m.faction_id = split_part(p_evenement, ':', 2) AND m.user_id = split_part(p_evenement, ':', 3)

        AND m.is_founder AND NOT f.retired AND NOT f.privee)

    WHEN 'adhesion' THEN (

      SELECT m.user_id FROM faction_members m JOIN factions f ON f.id = m.faction_id

      WHERE m.faction_id = split_part(p_evenement, ':', 2) AND m.user_id = split_part(p_evenement, ':', 3)

        AND NOT f.retired AND NOT f.privee)

    -- 410 : un message ne se salue plus à volonté (aimer_message, un cœur par personne).
    -- 481 : une énigme percée ce jour-là, dans cette culture (la ligne de « Sur les chemins », 449-451).
    WHEN 'enigme' THEN (
      SELECT r.user_id FROM enigma_responses r JOIN enigmas e ON e.id = r.enigma_id
      JOIN enigma_themes t ON t.id = e.theme
      WHERE r.user_id = split_part(p_evenement, ':', 2) AND e.theme = split_part(p_evenement, ':', 3)
        AND r.correct AND t.active AND r.responded_at::date::text = split_part(p_evenement, ':', 4)
      LIMIT 1)



  END;



$function$;
