-- WHY: dans « Sur les chemins », une ligne d'énigme par joueur, par culture et par jour (Uriel,
--      07/10) : la culture et son logo restent justes (« Sköll a percé 7 énigmes · Grèce antique »,
--      puis « 5 énigmes · Romaine »). Les autres lignes ne changent pas (leur culture est NULL).
--      L'id d'une ligne d'énigme gagne sa culture : les saluts de ce jour-là, rangés sous l'ancien
--      id, se perdent (quelques-uns, le jour même).
-- BASE: définition en ligne de sur_les_chemins après la 449 (pg_get_functiondef, 07/10), copiée
--      entière ; seuls changent l'id des lignes d'énigme et la clé du DISTINCT ON / du compte.
-- SCHEMA CHECKED (07/10) : enigmas.theme text ; enigma_responses.responded_at timestamptz.

CREATE OR REPLACE FUNCTION public.sur_les_chemins(p_limite integer DEFAULT 20)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id),
  evenements AS (
    (SELECT 'visite:' || e.place_id || ':' || e.user_id AS id, 'visite' AS type, e.visited_at AS quand,
            e.user_id AS qui, e.place_id AS lieu, NULL::text AS compagnie, NULL::text AS culture
     FROM place_explorers e JOIN places p ON p.id = e.place_id
     WHERE p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY e.visited_at DESC LIMIT 200)
    UNION ALL
    (SELECT 'ajout:' || p.id, 'ajout', p.created_at, p.author_id, p.id, NULL, NULL
     FROM places p
     WHERE p.author_id IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY p.created_at DESC LIMIT 200)
    UNION ALL
    -- 411 : les arrivées reviennent (un moment de bienvenue) ; les connexions restent retirées.
    (SELECT 'arrivee:' || u.id, 'arrivee', u.created_at, u.id, NULL, NULL, NULL
     FROM users u ORDER BY u.created_at DESC LIMIT 100)
    UNION ALL
    -- 406 : les revendications (V1 et V2 écrivent veille_history).
    (SELECT 'revendication:' || h.place_id || ':' || h.user_id || ':'
              || floor(extract(epoch FROM h.planted_at))::bigint,
            'revendication', h.planted_at, h.user_id, h.place_id, NULL, NULL
     FROM veille_history h JOIN places p ON p.id = h.place_id
     WHERE h.user_id IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY h.planted_at DESC LIMIT 200)
    UNION ALL
    -- 438 : celles de la V2 (registre `revendications`), avec la Compagnie pour laquelle on revendique
    -- (son nom est public, même privée).
    (SELECT 'revendication:' || r.place_id || ':' || r.user_id || ':'
              || floor(extract(epoch FROM r.cree_le))::bigint,
            'revendication', r.cree_le, r.user_id, r.place_id, r.pour_compagnie, NULL
     FROM revendications r JOIN places p ON p.id = r.place_id
     WHERE p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY r.cree_le DESC LIMIT 200)
    UNION ALL
    -- 415 : chaque version sauf l'origine (Uriel, 05/10 : « quand on enrichit / modifie un lieu ») ;
    -- « enrichi » si le récit ou une rubrique a changé, « modifié » sinon.
    (SELECT w.genre || ':' || w.place_id || ':' || w.auteur || ':' || floor(extract(epoch FROM w.cree_le))::bigint,
            w.genre, w.cree_le, w.auteur, w.place_id, NULL, NULL
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
    (SELECT 'fondation:' || f.id || ':' || m.user_id, 'fondation', f.created_at, m.user_id, NULL, f.id, NULL
     FROM factions f JOIN faction_members m ON m.faction_id = f.id AND m.is_founder
     WHERE NOT f.retired AND NOT f.privee
     ORDER BY f.created_at DESC LIMIT 50)
    UNION ALL
    (SELECT 'adhesion:' || f.id || ':' || m.user_id, 'adhesion', m.joined_at, m.user_id, NULL, f.id, NULL
     FROM faction_members m JOIN factions f ON f.id = m.faction_id
     WHERE NOT f.retired AND NOT f.privee AND m.is_founder IS NOT TRUE
     ORDER BY m.joined_at DESC LIMIT 200)
    UNION ALL
    -- 449 : une énigme percée (réponse juste), avec sa culture — jamais la question ni la réponse
    -- (pas de spoiler, .claude/rules/produit.md). Une ligne par personne et par jour : son id est
    -- celui du jour, pour que les saluts tiennent quand une autre énigme s'y ajoute.
    (SELECT 'enigme:' || r.user_id || ':' || e.theme || ':' || r.responded_at::date, 'enigme', r.responded_at, r.user_id,
            NULL, NULL, e.theme
     FROM enigma_responses r JOIN enigmas e ON e.id = r.enigma_id JOIN enigma_themes t ON t.id = e.theme
     WHERE r.correct AND t.active AND r.responded_at IS NOT NULL
     ORDER BY r.responded_at DESC LIMIT 200)
  ),
  -- Une ligne au plus par personne, par type et par jour : la plus récente.
  -- 449 : et combien ce jour-là (« a percé 3 énigmes »).
  une_par_jour AS (
    SELECT DISTINCT ON (type, qui, culture, quand::date) *,
           count(*) OVER (PARTITION BY type, qui, culture, quand::date) AS nombre
    FROM evenements ORDER BY type, qui, culture, quand::date, quand DESC
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
      'culture', CASE WHEN c.id IS NULL THEN NULL
        ELSE json_build_object('id', c.id, 'nom', c.label, 'couleur', c.color, 'icone', c.icon) END, -- 449
      'nombre', r.nombre, -- 449
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
  LEFT JOIN factions f ON f.id = r.compagnie AND NOT f.retired
  LEFT JOIN enigma_themes c ON c.id = r.culture;
$function$;
