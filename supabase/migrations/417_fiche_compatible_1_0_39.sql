-- WHY: correctif de la 415 : le front 1.0.39 encore en ligne lit faits.saison/acces/bivouac et
--      enrichiPar ; une clé absente fait échouer la lecture de toute fiche. On les rend à null le temps
--      que la 1.0.40 soit déployée (puis une migration les retire).
-- SCHEMA CHECKED (05/10/2026) : définition live de fiche_lieu (415).

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
      'annee', l.year_exact,
      -- 417 : lues par le front 1.0.39 (encore en ligne) ; toujours null. À retirer après 1.0.40.
      'saison', NULL, 'acces', NULL, 'bivouac', NULL),
    'enrichiPar', NULL,
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
