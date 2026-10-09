-- WHY: « Sur les chemins » dit quand une Compagnie est fondée et quand quelqu'un la rejoint (Uriel,
--      05/10) : les Compagnies publiques seulement, le fil étant lu de tous ; quitter ne se dit pas.
--      Une colonne de plus dans le fil (la Compagnie de la ligne), et _auteur_du_chemin connaît ces
--      deux lignes pour qu'on puisse les saluer.
-- SCHEMA CHECKED (05/10/2026) : définitions live de sur_les_chemins (415) et _auteur_du_chemin (415) ;
--      factions.created_at, faction_members.joined_at / is_founder (les 8 Compagnies actives ont leur
--      fondateur parmi leurs membres, vérifié en prod).

CREATE OR REPLACE FUNCTION public.sur_les_chemins(p_limite integer DEFAULT 20)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id),
  evenements AS (
    (SELECT 'visite:' || e.place_id || ':' || e.user_id AS id, 'visite' AS type, e.visited_at AS quand,
            e.user_id AS qui, e.place_id AS lieu, NULL::text AS compagnie
     FROM place_explorers e JOIN places p ON p.id = e.place_id
     WHERE p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY e.visited_at DESC LIMIT 200)
    UNION ALL
    (SELECT 'ajout:' || p.id, 'ajout', p.created_at, p.author_id, p.id, NULL
     FROM places p
     WHERE p.author_id IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY p.created_at DESC LIMIT 200)
    UNION ALL
    -- 411 : les arrivées reviennent (un moment de bienvenue) ; les connexions restent retirées.
    (SELECT 'arrivee:' || u.id, 'arrivee', u.created_at, u.id, NULL, NULL
     FROM users u ORDER BY u.created_at DESC LIMIT 100)
    UNION ALL
    -- 406 : les revendications (V1 et V2 écrivent veille_history).
    (SELECT 'revendication:' || h.place_id || ':' || h.user_id || ':'
              || floor(extract(epoch FROM h.planted_at))::bigint,
            'revendication', h.planted_at, h.user_id, h.place_id, NULL
     FROM veille_history h JOIN places p ON p.id = h.place_id
     WHERE h.user_id IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY h.planted_at DESC LIMIT 200)
    UNION ALL
    -- 415 : chaque version sauf l'origine (Uriel, 05/10 : « quand on enrichit / modifie un lieu ») ;
    -- « enrichi » si le récit ou une rubrique a changé, « modifié » sinon.
    (SELECT w.genre || ':' || w.place_id || ':' || w.auteur || ':' || floor(extract(epoch FROM w.cree_le))::bigint,
            w.genre, w.cree_le, w.auteur, w.place_id, NULL
     FROM (
       SELECT v.place_id, v.auteur, v.cree_le, lag(v.id) OVER o AS precedente,
              CASE WHEN v.recit IS DISTINCT FROM lag(v.recit) OVER o
                     OR v.acces IS DISTINCT FROM lag(v.acces) OVER o
                     OR v.quand IS DISTINCT FROM lag(v.quand) OVER o
                     OR v.bon_a_savoir IS DISTINCT FROM lag(v.bon_a_savoir) OVER o
                   THEN 'enrichi' ELSE 'modifie' END AS genre
       FROM versions_lieu v WINDOW o AS (PARTITION BY v.place_id ORDER BY v.cree_le, v.id)) w
     JOIN places p ON p.id = w.place_id
     WHERE w.precedente IS NOT NULL AND w.auteur IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY w.cree_le DESC LIMIT 200)
    UNION ALL
    -- 425 : fonder une Compagnie, la rejoindre — les publiques seulement (le fil est lu de tous).
    (SELECT 'fondation:' || f.id || ':' || m.user_id, 'fondation', f.created_at, m.user_id, NULL, f.id
     FROM factions f JOIN faction_members m ON m.faction_id = f.id AND m.is_founder
     WHERE NOT f.retired AND NOT f.privee
     ORDER BY f.created_at DESC LIMIT 50)
    UNION ALL
    (SELECT 'adhesion:' || f.id || ':' || m.user_id, 'adhesion', m.joined_at, m.user_id, NULL, f.id
     FROM faction_members m JOIN factions f ON f.id = m.faction_id
     WHERE NOT f.retired AND NOT f.privee AND m.is_founder IS NOT TRUE
     ORDER BY m.joined_at DESC LIMIT 200)
  ),
  -- Une ligne au plus par personne, par type et par jour : la plus récente.
  une_par_jour AS (
    SELECT DISTINCT ON (type, qui, quand::date) *
    FROM evenements ORDER BY type, qui, quand::date, quand DESC
  ),
  retenus AS (
    SELECT * FROM une_par_jour ORDER BY quand DESC LIMIT least(greatest(p_limite, 1), 50)
  )
  SELECT COALESCE(json_agg(json_build_object(
      'id', r.id,
      'type', r.type,
      'quand', r.quand,
      'qui', json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url),
      'lieu', CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object(
                'id', p.id, 'nom', p.title, 'region', COALESCE(p.departement, p.pays),
                'type', (SELECT json_build_object('icone', t.icon, 'couleur', t.color)
                         FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
                         WHERE pt.place_id = p.id AND pt.is_primary AND t.icon IS NOT NULL
                         LIMIT 1)) END,
      'compagnie', CASE WHEN f.id IS NULL THEN NULL
        ELSE json_build_object('id', f.id, 'nom', f.title, 'couleur', f.color) END, -- 425
      'moi', r.qui = moi.id, -- ma propre ligne : on ne se salue pas soi-même
      -- 413 : un ajout porte les cœurs de la fiche du lieu ; les autres lignes, leurs saluts.
      'saluts', CASE WHEN r.type = 'ajout'
        THEN (SELECT COALESCE(sum(c.nombre), 0) FROM coeurs_lieu c WHERE c.place_id = r.lieu)
        ELSE (SELECT COALESCE(sum(s.nombre), 0) FROM saluts s WHERE s.evenement = r.id) END,
      'salue', CASE WHEN r.type = 'ajout'
        THEN EXISTS (SELECT 1 FROM coeurs_lieu c WHERE c.place_id = r.lieu AND c.user_id = moi.id)
        ELSE EXISTS (SELECT 1 FROM saluts s WHERE s.evenement = r.id AND s.user_id = moi.id) END)
    ORDER BY r.quand DESC), '[]'::json)
  FROM retenus r
  CROSS JOIN moi
  JOIN users u ON u.id = r.qui
  LEFT JOIN places p ON p.id = r.lieu
  LEFT JOIN factions f ON f.id = r.compagnie;
$function$;


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
    WHEN 'revendication' THEN (
      SELECT h.user_id FROM veille_history h JOIN places p ON p.id = h.place_id
      WHERE h.place_id = split_part(p_evenement, ':', 2) AND h.user_id = split_part(p_evenement, ':', 3)
        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1)
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

  END;

$function$;
