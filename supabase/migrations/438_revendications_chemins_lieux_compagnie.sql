-- WHY: deux trous vus par Uriel le 07/10 sur les Compagnies.
--   1. Une revendication faite dans la V2 n'apparaissait jamais dans « Sur les chemins » : le fil lit
--      `veille_history`, que la V2 n'écrit pas exprès (une revendication d'Explore ne compte pas en
--      V1, décision du 28/09). Et revendiquer « pour » sa Compagnie un lieu qu'on tient déjà
--      n'écrivait rien de nouveau. Un registre `revendications`, écrit à chaque revendication de la
--      V2 (les deux chemins de `_revendiquer`), lu par le fil avec la Compagnie — son nom est public,
--      même privée (Uriel). `_auteur_du_chemin` le connaît, pour qu'on puisse saluer ces lignes.
--   2. « Leurs lieux », sur la fiche d'une Compagnie, sans photo : chaque lieu devient une carte
--      (`_carte_lieu`, comme le profil), l'auteur étant qui l'a revendiqué. `par` et `quand` restent.
-- BASE: définitions copiées entières — `_revendiquer` (427), `sur_les_chemins` et `_auteur_du_chemin`
--       (425, aucune migration ne les a recréées depuis), `compagnie` (435, vérifiée en prod).
-- SCHEMA CHECKED (2026-10-07) : places.id text, users.id varchar, factions.id varchar (FK des migs
--   420 et 427) ; `_carte_lieu(text)` (358) : id, nom, imageUrl, latitude, longitude, categorie, auteur.

CREATE TABLE public.revendications (
  id bigserial PRIMARY KEY,
  place_id text NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pour_compagnie varchar REFERENCES public.factions(id) ON DELETE SET NULL,
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX revendications_cree_le ON public.revendications (cree_le DESC);
-- On n'y touche que par les fonctions ci-dessous.
ALTER TABLE public.revendications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.revendications FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.revendications_id_seq FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public._revendiquer(p_id text, p_moi text, p_valides text[], p_nom text, p_pour text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_faction text;
  v_expedition uuid;
  v_bonus integer;
BEGIN
  -- Déjà tenant, seul : on rafraîchit la date, sans nouvelle expédition (comme la V1).
  IF cardinality(p_valides) = 0 AND EXISTS (
    SELECT 1 FROM place_veille v
    WHERE v.place_id = p_id
      AND (v.veilleur_user_id = p_moi
        OR EXISTS (SELECT 1 FROM expedition_members m WHERE m.expedition_id = v.expedition_id AND m.user_id = p_moi))) THEN
    UPDATE place_veille SET planted_at = now(), pour_compagnie = COALESCE(p_pour, pour_compagnie) WHERE place_id = p_id;
    UPDATE expeditions SET pour_compagnie = COALESCE(p_pour, pour_compagnie)
    WHERE id = (SELECT expedition_id FROM place_veille WHERE place_id = p_id);
    INSERT INTO revendications (place_id, user_id, pour_compagnie) VALUES (p_id, p_moi, p_pour); -- 438
    RETURN json_build_object('nom', (
      SELECT COALESCE(NULLIF(x.title, ''), user_public_name(u.id, u.display_name, u.first_name))
      FROM place_veille v LEFT JOIN expeditions x ON x.id = v.expedition_id LEFT JOIN users u ON u.id = p_moi
      WHERE v.place_id = p_id));
  END IF;

  SELECT faction_id INTO v_faction FROM users WHERE id = p_moi;
  INSERT INTO expeditions (place_id, is_neutral, faction_id, title, pour_compagnie)
  VALUES (p_id, v_faction IS NULL, v_faction, p_nom, p_pour)
  RETURNING id INTO v_expedition;
  INSERT INTO expedition_members (expedition_id, user_id, faction_id)
  SELECT v_expedition, u.id, u.faction_id FROM users u WHERE u.id = ANY (p_valides || p_moi);

  INSERT INTO place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id, veilleur_user_id)
  VALUES (p_id, v_expedition, v_faction, v_faction IS NULL, now(), false, NULL, p_moi)
  ON CONFLICT (place_id) DO UPDATE SET
    expedition_id = EXCLUDED.expedition_id, faction_id = EXCLUDED.faction_id,
    is_neutral = EXCLUDED.is_neutral, planted_at = now(), by_influence = false,
    previous_expedition_id = NULL, veilleur_user_id = p_moi, pour_compagnie = p_pour;

  -- La Cour V1 repart de zéro, avec le bonus de plantage de la V1 : on ne reprend pas à distance
  -- un lieu revendiqué sur place (Uriel, 28/09). Pas de ligne veille_history : une revendication
  -- faite dans Explore ne compte pas en V1 (ni Gloire, ni Coupe, ni titres, ni classement).
  v_bonus := COALESCE((SELECT value::integer FROM app_settings WHERE key = 'plant_flag_solo_bonus'), 50)
    + COALESCE((SELECT value::integer FROM app_settings WHERE key = 'plant_flag_per_extra_member'), 30)
      * LEAST(cardinality(p_valides), COALESCE((SELECT value::integer FROM app_settings WHERE key = 'plant_flag_max_members_for_bonus'), 10));
  DELETE FROM place_court_action WHERE place_id = p_id AND beneficiary_user_id IS DISTINCT FROM p_moi;
  INSERT INTO place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
  VALUES (p_id, p_moi, v_expedition, p_moi, 'plant_bonus', v_bonus);
  DELETE FROM place_court_score WHERE place_id = p_id;
  INSERT INTO revendications (place_id, user_id, pour_compagnie) VALUES (p_id, p_moi, p_pour); -- 438

  RETURN json_build_object('nom', COALESCE(p_nom,
    (SELECT user_public_name(u.id, u.display_name, u.first_name) FROM users u WHERE u.id = p_moi)));
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
    -- 438 : celles de la V2 (registre `revendications`), avec la Compagnie pour laquelle on revendique
    -- (son nom est public, même privée).
    (SELECT 'revendication:' || r.place_id || ':' || r.user_id || ':'
              || floor(extract(epoch FROM r.cree_le))::bigint,
            'revendication', r.cree_le, r.user_id, r.place_id, r.pour_compagnie
     FROM revendications r JOIN places p ON p.id = r.place_id
     WHERE p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY r.cree_le DESC LIMIT 200)
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
  LEFT JOIN factions f ON f.id = r.compagnie AND NOT f.retired;
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

  END;

$function$;

CREATE OR REPLACE FUNCTION public.compagnie(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id),
  r AS (SELECT public._role_compagnie(p_id, moi.id) AS role FROM moi)
  SELECT json_build_object(
    'id', f.id, 'nom', f.title, 'devise', f.devise, 'mission', f.description, 'couleur', f.color,
    'avatar', f.image_url, 'privee', f.privee, 'fondeeLe', f.created_at,
    'roles', json_build_object('chefM', f.chef_m, 'chefF', f.chef_f, 'officierM', f.officier_m, 'officierF', f.officier_f),
    'monRole', r.role,
    'demandee', EXISTS (SELECT 1 FROM demandes_compagnie d WHERE d.faction_id = f.id AND d.user_id = moi.id),
    'nbMembres', (SELECT count(*) FROM faction_members m WHERE m.faction_id = f.id),
    'membres', CASE WHEN NOT f.privee OR r.role IS NOT NULL THEN COALESCE((SELECT json_agg(json_build_object('id', u.id,
        'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url, 'role', m.role,
        'genre', CASE WHEN u.title_gender = 'f' THEN 'f' ELSE 'm' END,
        'niveau', public._level_from_xp(COALESCE(u.xp_total, 0)),
        'titre', (SELECT t.name
                    FROM unnest(u.displayed_title_ids_v3) WITH ORDINALITY AS x(tid, ord)
                    JOIN public.titles t ON t.id = x.tid AND t.type = 'general'
                   ORDER BY x.ord
                   LIMIT 1))
        ORDER BY CASE m.role WHEN 'chef' THEN 0 WHEN 'officier' THEN 1 ELSE 2 END, m.joined_at DESC)
      FROM faction_members m JOIN users u ON u.id = m.user_id WHERE m.faction_id = f.id), '[]'::json) ELSE '[]'::json END,
    'lieux', COALESCE((SELECT json_agg(public._carte_lieu(l.id)::jsonb || jsonb_build_object(
        'par', l.par, 'quand', l.quand,
        'auteur', CASE WHEN l.par IS NULL THEN NULL ELSE jsonb_build_object('nom', l.par, 'avatarUrl', l.avatar) END)
        ORDER BY l.quand DESC)
      FROM (SELECT DISTINCT ON (x.place_id) p.id, p.title, x.created_at AS quand,
              COALESCE(NULLIF(x.title, ''), (SELECT user_public_name(u.id, u.display_name, u.first_name)
                FROM expedition_members em JOIN users u ON u.id = em.user_id WHERE em.expedition_id = x.id LIMIT 1)) AS par,
              -- 438 : l'avatar de qui a revendiqué ; une expédition nommée n'en a pas.
              CASE WHEN NULLIF(x.title, '') IS NULL THEN (SELECT u.avatar_url
                FROM expedition_members em JOIN users u ON u.id = em.user_id WHERE em.expedition_id = x.id LIMIT 1) END AS avatar
            FROM expeditions x JOIN places p ON p.id = x.place_id
            WHERE x.pour_compagnie = f.id AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
            ORDER BY x.place_id, x.created_at DESC) l), '[]'::json),
    'demandes', CASE WHEN r.role IN ('chef', 'officier') THEN COALESCE((SELECT json_agg(json_build_object(
        'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url,
        'mot', d.mot, 'quand', d.cree_le) ORDER BY d.cree_le)
      FROM demandes_compagnie d JOIN users u ON u.id = d.user_id WHERE d.faction_id = f.id), '[]'::json) ELSE '[]'::json END)
  FROM factions f, moi, r
  WHERE f.id = p_id AND NOT f.retired AND moi.id IS NOT NULL;
$function$;
