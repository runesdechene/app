-- WHY: sous un lieu d'un territoire, le nom de la revendication fait doublon avec la banderole du
-- blason (Uriel, 01/11/2026) : la carte doit savoir quels lieux en sont, pour taire leur nom.
-- `territoires_revendiques` rend donc `ids`, les identifiants de ses lieux ; rien d'autre ne change.
-- Définition live copiée entière (celle de la 572), une clé ajoutée.
-- SCHEMA CHECKED (2026-11-01) : aucune colonne nouvelle.
CREATE OR REPLACE FUNCTION public.territoires_revendiques()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions' AS $function$
  SELECT COALESCE(json_agg(json_build_object(
    'id', t.lieux[1],
    'nom', n.nom,
    'moi', public._territoire_a_moi(t.cle, (auth.uid())::text),
    'lieux', cardinality(t.lieux),
    'ids', t.lieux,
    'forme', ST_AsGeoJSON(t.forme, 5)::json,
    'ancre', json_build_array(round(ST_X(ST_Centroid(t.forme))::numeric, 5),
                              round(ST_YMax(t.forme)::numeric, 5)),
    -- Ceux qui l'ont revendiqué avec lui (les expéditions de ses lieux), lui excepté.
    'compagnons', (SELECT count(DISTINCT m.user_id)
                   FROM place_veille v
                   JOIN expedition_members m ON m.expedition_id = v.expedition_id
                   WHERE v.place_id = ANY (t.lieux) AND m.user_id IS DISTINCT FROM v.veilleur_user_id),
    'joueur', (SELECT json_build_object(
                 'id', u.id,
                 'nom', user_public_name(u.id, u.display_name, u.first_name),
                 'avatar', u.avatar_url,
                 'niveau', public._level_from_xp(COALESCE(u.xp_total, 0)),
                 'titre', (SELECT public._nom_titre(ti, u.title_gender)
                           FROM unnest(u.displayed_title_ids_v3) WITH ORDINALITY AS x(tid, ord)
                           JOIN titles ti ON ti.id = x.tid AND ti.type = 'general'
                           ORDER BY x.ord LIMIT 1),
                 'signe', (SELECT json_build_object('nom', tf.name, 'imageUrl', COALESCE(tf.image_url, tf.icon_url))
                           FROM title_fragments tf
                           WHERE tf.id = u.signe_fragment_id AND tf.visible
                             AND COALESCE(tf.image_url, tf.icon_url) IS NOT NULL
                             AND EXISTS (SELECT 1 FROM user_fragments uf
                                         WHERE uf.user_id = u.id AND uf.fragment_id = tf.id)))
               FROM users u WHERE t.cle = 'j:' || u.id)
  )), '[]'::json)
  FROM public._territoires() t
  CROSS JOIN LATERAL (SELECT COALESCE(
    (SELECT nt.nom FROM noms_de_territoire nt
     WHERE nt.cle = t.cle AND nt.place_id = ANY (t.lieux)
     ORDER BY nt.nomme_le DESC LIMIT 1),
    (SELECT mode() WITHIN GROUP (ORDER BY
              COALESCE(NULLIF(x.title, ''), user_public_name(u.id, u.display_name, u.first_name)))
     FROM place_veille v
     LEFT JOIN expeditions x ON x.id = v.expedition_id
     LEFT JOIN users u ON u.id = v.veilleur_user_id
     WHERE v.place_id = ANY (t.lieux))
  ) AS nom) n;
$function$;
