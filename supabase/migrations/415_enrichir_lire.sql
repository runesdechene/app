-- WHY: enrichir un lieu, la lecture : la fiche lit les rubriques, le bivouac et « Récit partagé de… »
--      (recitPar remplace enrichiPar) ; l'histoire nomme les rubriques ; version_du_lieu donne l'avant
--      et l'après d'une version ; « Sur les chemins » lit versions_lieu (enrichi / modifié, Uriel 05/10).
--      À appliquer avec la 416 (l'histoire V1 entre dans versions_lieu), jamais seule.
-- SCHEMA CHECKED (05/10/2026) : colonnes de la mig 414 ; définitions live (pg_get_functiondef) de
--      fiche_lieu, histoire_du_lieu, sur_les_chemins, _auteur_du_chemin.

CREATE OR REPLACE FUNCTION public.fiche_lieu(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id)
  SELECT json_build_object(
    'id', l.id,
    'slug', l.slug, -- la page publique du lieu (/lieu/<slug>), pour le partage
    'nom', l.title,
    'recit', COALESCE(l.text, ''),
    'adresse', NULLIF(btrim(l.address), ''),
    'lat', l.latitude,
    'lng', l.longitude,
    'nature', l.nature,
    'photos', public._photos_du_lieu(l.id),
    'type', (
      SELECT json_build_object('nom', t.title, 'icone', t.icon, 'couleur', t.color)
      FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
      WHERE pt.place_id = l.id AND pt.is_primary LIMIT 1),
    'faits', json_build_object(
      -- « Non concerné » (une source, un spot de van) ne se dit pas : pas d'époque à afficher.
      'epoque', (SELECT e.name FROM eras e WHERE e.id = l.era_id AND e.id <> 'not-applicable'),
      'annee', l.year_exact),
    -- 415 : les rubriques pratiques et le bivouac (mig 414), écrits en versions comme le récit.
    'rubriques', json_build_object('acces', l.acces, 'quand', l.quand, 'bonASavoir', l.bon_a_savoir),
    'bivouacTolere', l.bivouac_tolere,
    'explorateurs', json_build_object(
      'nombre', (SELECT count(*) FROM place_explorers e WHERE e.place_id = l.id),
      'derniers', COALESCE((
        SELECT json_agg(d.x) FROM (
          SELECT json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url) AS x
          FROM place_explorers e JOIN users u ON u.id = e.user_id
          WHERE e.place_id = l.id ORDER BY e.visited_at DESC LIMIT 3) d), '[]'::json)),
    -- La pilule : l'expédition si elle a un nom, sinon le dernier qui l'a revendiqué (comme 363).
    'revendication', (
      SELECT json_build_object(
        'nom', COALESCE(NULLIF(x.title, ''), user_public_name(u.id, u.display_name, u.first_name)),
        'moi', v.veilleur_user_id = moi.id
          OR EXISTS (SELECT 1 FROM expedition_members m WHERE m.expedition_id = v.expedition_id AND m.user_id = moi.id),
        'depuis', v.planted_at)
      FROM place_veille v
      LEFT JOIN expeditions x ON x.id = v.expedition_id
      LEFT JOIN users u ON u.id = v.veilleur_user_id
      WHERE v.place_id = l.id AND l.nature = 'lieu'),
    'auteur', (
      SELECT json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url)
      FROM users u WHERE u.id = l.author_id),
    'ajouteLe', l.created_at,
    -- Ajouté à distance (sans y être) : noté par le journal depuis le 08/04/2026, V1 comme V2.
    -- Avant, on ne sait pas : rien n'est dit.
    'ajoutADistance', EXISTS (
      SELECT 1 FROM activity_log a
      WHERE a.type = 'new_place' AND a.place_id = l.id AND a.data->>'isGps' = 'false'),
    -- 415 : « Récit partagé de… » — qui a changé le texte du récit, par ordre d'arrivée (l'origine
    -- comprise ; sans version, l'auteur seul).
    'recitPar', COALESCE((
      SELECT json_agg(json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
                                        'avatar', u.avatar_url) ORDER BY a.premiere)
      FROM (
        SELECT w.auteur, min(w.cree_le) AS premiere
        FROM (SELECT v.auteur, v.cree_le, v.recit, lag(v.id) OVER o AS precedente, lag(v.recit) OVER o AS recit_avant
              FROM versions_lieu v WHERE v.place_id = l.id WINDOW o AS (ORDER BY v.cree_le, v.id)) w
        WHERE w.auteur IS NOT NULL AND (w.precedente IS NULL OR w.recit IS DISTINCT FROM w.recit_avant)
        GROUP BY w.auteur) a
      JOIN users u ON u.id = a.auteur),
      (SELECT json_build_array(json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
                                                 'avatar', u.avatar_url))
       FROM users u WHERE u.id = l.author_id
         AND NOT EXISTS (SELECT 1 FROM versions_lieu v WHERE v.place_id = l.id)),
      '[]'::json),
    'moi', json_build_object(
      'visiteLe', (SELECT e.visited_at FROM place_explorers e WHERE e.place_id = l.id AND e.user_id = moi.id),
      'envie', EXISTS (SELECT 1 FROM place_wishlist w WHERE w.place_id = l.id AND w.user_id = moi.id),
      -- Découvert : ajouté, visité ou découvert à distance (la même règle que carte_lieux, 363).
      'decouvert', l.author_id = moi.id
        OR EXISTS (SELECT 1 FROM place_explorers e WHERE e.place_id = l.id AND e.user_id = moi.id)
        OR EXISTS (SELECT 1 FROM places_discovered d WHERE d.place_id = l.id AND d.user_id = moi.id)))
  FROM places l CROSS JOIN moi
  WHERE l.id = p_id AND public._lieu_visible(p_id);
$function$;

CREATE OR REPLACE FUNCTION public.histoire_du_lieu(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH v AS (
    SELECT id, auteur, cree_le, note, nom, natures, epoque, annee, recit,
           lag(nom) OVER w AS nom_avant, lag(natures) OVER w AS natures_avant,
           lag(epoque) OVER w AS epoque_avant, lag(annee) OVER w AS annee_avant,
           lag(recit) OVER w AS recit_avant, lag(id) OVER w AS precedente,
           acces, quand, bon_a_savoir, bivouac_tolere,
           lag(acces) OVER w AS acces_avant, lag(quand) OVER w AS quand_avant,
           lag(bon_a_savoir) OVER w AS bon_avant, lag(bivouac_tolere) OVER w AS bivouac_avant
    FROM versions_lieu WHERE place_id = p_id
    WINDOW w AS (ORDER BY cree_le, id)
  ),
  lignes AS (
    SELECT id, auteur, cree_le, note, precedente IS NULL AS origine,
      array_remove(ARRAY[
        CASE WHEN precedente IS NOT NULL AND nom IS DISTINCT FROM nom_avant THEN 'nom' END,
        CASE WHEN precedente IS NOT NULL AND natures IS DISTINCT FROM natures_avant THEN 'natures' END,
        CASE WHEN precedente IS NOT NULL AND (epoque IS DISTINCT FROM epoque_avant OR annee IS DISTINCT FROM annee_avant) THEN 'epoque' END,
        CASE WHEN precedente IS NOT NULL AND recit IS DISTINCT FROM recit_avant THEN 'recit' END,
        CASE WHEN precedente IS NOT NULL AND acces IS DISTINCT FROM acces_avant THEN 'acces' END,
        CASE WHEN precedente IS NOT NULL AND quand IS DISTINCT FROM quand_avant THEN 'quand' END,
        CASE WHEN precedente IS NOT NULL AND bon_a_savoir IS DISTINCT FROM bon_avant THEN 'bon_a_savoir' END,
        CASE WHEN precedente IS NOT NULL AND bivouac_tolere IS DISTINCT FROM bivouac_avant THEN 'bivouac' END], NULL) AS champs
    FROM v
    UNION ALL
    SELECT NULL, p.author_id, p.created_at, NULL, true, '{}'::text[]
    FROM places p WHERE p.id = p_id AND NOT EXISTS (SELECT 1 FROM versions_lieu WHERE place_id = p_id)
  )
  SELECT CASE WHEN NOT public._lieu_visible(p_id) THEN NULL ELSE COALESCE(json_agg(json_build_object(
      'id', l.id,
      'quand', l.cree_le,
      'origine', l.origine,
      'champs', l.champs,
      'note', l.note,
      'qui', CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object(
               'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url) END)
    ORDER BY l.cree_le DESC, l.id DESC NULLS LAST), '[]'::json) END
  FROM lignes l LEFT JOIN users u ON u.id = l.auteur;
$function$;

-- Une version et la précédente : les textes qui ont changé (récit, rubriques), pour la feuille
-- « Une version » ; la comparaison mot à mot se fait dans l'appli. null : introuvable ou invisible.
CREATE FUNCTION public.version_du_lieu(p_version bigint)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH v AS (SELECT * FROM versions_lieu WHERE id = p_version),
  avant AS (
    SELECT p.* FROM versions_lieu p, v
    WHERE p.place_id = v.place_id AND (p.cree_le, p.id) < (v.cree_le, v.id)
    ORDER BY p.cree_le DESC, p.id DESC LIMIT 1)
  SELECT CASE WHEN NOT public._lieu_visible(v.place_id) THEN NULL ELSE json_build_object(
    'id', v.id,
    'quand', v.cree_le,
    'note', v.note,
    'qui', (SELECT json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url)
            FROM users u WHERE u.id = v.auteur),
    'champs', COALESCE((
      SELECT json_agg(json_build_object('champ', c.champ, 'avant', COALESCE(c.avant, ''), 'apres', COALESCE(c.apres, '')) ORDER BY c.rang)
      FROM (VALUES (1, 'recit', a.recit, v.recit), (2, 'acces', a.acces, v.acces),
                   (3, 'quand', a.quand, v.quand), (4, 'bon_a_savoir', a.bon_a_savoir, v.bon_a_savoir)) c(rang, champ, avant, apres)
      WHERE c.avant IS DISTINCT FROM c.apres), '[]'::json)) END
  FROM v LEFT JOIN avant a ON true;
$function$;
REVOKE ALL ON FUNCTION public.version_du_lieu(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.version_du_lieu(bigint) TO authenticated;

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
    -- 410 : un message ne se salue plus à volonté (aimer_message, un cœur par personne).

  END;

$function$;

CREATE OR REPLACE FUNCTION public.sur_les_chemins(p_limite integer DEFAULT 20)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id),
  evenements AS (
    (SELECT 'visite:' || e.place_id || ':' || e.user_id AS id, 'visite' AS type, e.visited_at AS quand,
            e.user_id AS qui, e.place_id AS lieu
     FROM place_explorers e JOIN places p ON p.id = e.place_id
     WHERE p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY e.visited_at DESC LIMIT 200)
    UNION ALL
    (SELECT 'ajout:' || p.id, 'ajout', p.created_at, p.author_id, p.id
     FROM places p
     WHERE p.author_id IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY p.created_at DESC LIMIT 200)
    UNION ALL
    -- 411 : les arrivées reviennent (un moment de bienvenue) ; les connexions restent retirées.
    (SELECT 'arrivee:' || u.id, 'arrivee', u.created_at, u.id, NULL
     FROM users u ORDER BY u.created_at DESC LIMIT 100)
    UNION ALL
    -- 406 : les revendications (V1 et V2 écrivent veille_history).
    (SELECT 'revendication:' || h.place_id || ':' || h.user_id || ':'
              || floor(extract(epoch FROM h.planted_at))::bigint,
            'revendication', h.planted_at, h.user_id, h.place_id
     FROM veille_history h JOIN places p ON p.id = h.place_id
     WHERE h.user_id IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY h.planted_at DESC LIMIT 200)
    UNION ALL
    -- 415 : chaque version sauf l'origine (Uriel, 05/10 : « quand on enrichit / modifie un lieu ») ;
    -- « enrichi » si le récit ou une rubrique a changé, « modifié » sinon.
    (SELECT w.genre || ':' || w.place_id || ':' || w.auteur || ':' || floor(extract(epoch FROM w.cree_le))::bigint,
            w.genre, w.cree_le, w.auteur, w.place_id
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
  LEFT JOIN places p ON p.id = r.lieu;
$function$;
