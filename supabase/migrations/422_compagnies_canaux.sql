-- WHY: les Compagnies dans La Communauté (spec compagnies) : leurs canaux s'ajoutent au Registre pour leurs
--      seuls membres ; la revendication peut se faire « pour » une Compagnie ; la fiche d'un lieu et le
--      profil le disent.
-- SCHEMA CHECKED (05/10/2026) : migs 420-421 ; définitions live de registre, ecrire_au_registre,
--      registre_non_lus, revendiquer_lieu, fiche_lieu (avec la compatibilité de la 417),
--      get_profil_explorateur.
-- DROP vérifié (pg_proc.prosrc, 05/10) : revendiquer_lieu n'est appelée que par le front V2 et par
--      ajouter_lieu, avec 3 arguments — la nouvelle signature (4ᵉ facultatif) les accepte.

DROP FUNCTION public.revendiquer_lieu(text, text[], text);
CREATE FUNCTION public.mes_canaux() RETURNS json LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $function$
  SELECT COALESCE(json_agg(json_build_object('id', f.id, 'nom', f.title, 'couleur', f.color) ORDER BY f.title), '[]'::json)
  FROM faction_members m JOIN factions f ON f.id = m.faction_id
  WHERE m.user_id = (auth.uid())::text AND NOT f.retired;
$function$;
REVOKE ALL ON FUNCTION public.mes_canaux() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mes_canaux() TO authenticated;

CREATE OR REPLACE FUNCTION public.registre(p_canaux text[] DEFAULT ARRAY['general'::text, 'bugs'::text], p_limite integer DEFAULT 80)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object(
      'id', m.id,
      'canal', m.channel,
      -- 422 : le nom et la couleur d'un canal de Compagnie.
      'canalNom', (SELECT f.title FROM factions f WHERE f.id = m.channel),
      'canalCouleur', (SELECT f.color FROM factions f WHERE f.id = m.channel),
      'texte', m.content,
      'quand', m.created_at,
      'auteur', json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url),
      'moi', m.user_id = (auth.uid())::text,
      'mentions', COALESCE((
        SELECT json_agg(json_build_object('id', v.id, 'nom', user_public_name(v.id, v.display_name, v.first_name)))
        FROM chat_mentions cm JOIN users v ON v.id = cm.user_id
        WHERE cm.message_id = m.id), '[]'::json),
      'mentionneMoi', EXISTS (SELECT 1 FROM chat_mentions cm WHERE cm.message_id = m.id AND cm.user_id = (auth.uid())::text),
      -- 410 : qui a aimé le message (un cœur par personne, du premier au dernier), et si j'en suis.
      'coeurs', COALESCE((
        SELECT json_agg(json_build_object('id', v.id, 'nom', user_public_name(v.id, v.display_name, v.first_name), 'avatar', v.avatar_url)
                        ORDER BY s.created_at)
        FROM saluts s JOIN users v ON v.id = s.user_id
        WHERE s.evenement = 'message:' || m.id), '[]'::json),
      'aime', EXISTS (SELECT 1 FROM saluts s WHERE s.evenement = 'message:' || m.id AND s.user_id = (auth.uid())::text))
    ORDER BY m.created_at, m.id), '[]'::json)
  FROM (
    SELECT * FROM chat_messages c
    WHERE c.channel = ANY (p_canaux)
      -- 422 : les canaux de mes Compagnies aussi.
      AND (c.channel IN ('general', 'bugs') OR c.channel = ANY (COALESCE((SELECT array_agg(m.faction_id::text) FROM faction_members m JOIN factions f ON f.id = m.faction_id WHERE m.user_id = (auth.uid())::text AND NOT f.retired), '{}')))
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT least(greatest(p_limite, 1), 200)
  ) m
  JOIN users u ON u.id = m.user_id
  WHERE auth.uid() IS NOT NULL;
$function$;

CREATE OR REPLACE FUNCTION public.ecrire_au_registre(p_canal text, p_texte text, p_mentions text[] DEFAULT '{}'::text[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_texte text := btrim(p_texte);
  v_nom text;
  v_id bigint;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  -- 422 : une Compagnie dont je suis membre est un canal aussi.
  IF p_canal NOT IN ('general', 'bugs') AND public._role_compagnie(p_canal, v_moi) IS NULL THEN
    RAISE EXCEPTION 'Canal inconnu' USING ERRCODE = '22023';
  END IF;
  IF v_texte IS NULL OR char_length(v_texte) = 0 OR char_length(v_texte) > 500 THEN
    RAISE EXCEPTION 'Message vide ou trop long' USING ERRCODE = '22023';
  END IF;
  SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom FROM users u WHERE u.id = v_moi;
  INSERT INTO chat_messages (channel, user_id, user_name, content)
  VALUES (p_canal, v_moi, COALESCE(v_nom, 'Explorateur'), v_texte)
  RETURNING id INTO v_id;

  -- Les mentions : un compte qui existe, dont « @Nom » est bien dans le texte, pas soi-même.
  INSERT INTO chat_mentions (message_id, user_id)
  SELECT DISTINCT v_id, u.id
  FROM unnest(COALESCE(p_mentions, '{}')) AS m(id)
  JOIN users u ON u.id = m.id
  WHERE u.id <> v_moi
    AND position('@' || user_public_name(u.id, u.display_name, u.first_name) IN v_texte) > 0;

  -- Chaque personne mentionnée est prévenue ; un échec ici n'empêche pas le message de partir.
  BEGIN
    PERFORM notify(m.user_id, 'mention', jsonb_build_object(
      'actorId', v_moi, 'actorName', v_nom, 'canal', p_canal, 'messageId', v_id,
      'extrait', left(v_texte, 140)))
    FROM chat_mentions m WHERE m.message_id = v_id;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'ecrire_au_registre : notification des mentions en échec (%)', SQLERRM;
  END;

  RETURN json_build_object('id', v_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.registre_non_lus()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH moi AS (
    SELECT (auth.uid())::text AS id,
           (SELECT r.lu_jusqua FROM registre_lu r WHERE r.user_id = (auth.uid())::text) AS lu
  )
  SELECT json_build_object(
    'messages', (
      SELECT count(*)::int FROM (
        SELECT 1 FROM chat_messages m, moi
        WHERE moi.lu IS NOT NULL AND m.id > moi.lu
          AND (m.channel IN ('general', 'bugs') OR public._role_compagnie(m.channel, moi.id) IS NOT NULL)
          AND m.user_id IS DISTINCT FROM moi.id
        LIMIT 100) x),
    'mentions', (
      SELECT count(*)::int
      FROM chat_mentions cm JOIN chat_messages m ON m.id = cm.message_id, moi
      WHERE cm.user_id = moi.id AND m.id > COALESCE(moi.lu, 0)))
  FROM moi
  WHERE moi.id IS NOT NULL;
$function$;

CREATE OR REPLACE FUNCTION public.revendiquer_lieu(p_id text, p_compagnons text[], p_nom text, p_pour_compagnie text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_valides text[];
  v_nom text := NULLIF(btrim(p_nom), '');
  v_faction text;
  v_pour text := NULLIF(btrim(COALESCE(p_pour_compagnie, '')), '');
  v_expedition uuid;
  v_bonus integer;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM places WHERE id = p_id AND nature = 'lieu' AND public._lieu_visible(p_id)) THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM place_explorers
    WHERE place_id = p_id AND user_id = v_moi AND visited_at > now() - interval '30 minutes') THEN
    RAISE EXCEPTION 'Visite trop ancienne' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public._presents_autour(p_id) a WHERE a.user_id = v_moi) THEN
    RAISE EXCEPTION 'Pas sur place' USING ERRCODE = 'P0001';
  END IF;

  -- Seuls comptent les compagnons présents maintenant : les autres sont ignorés.
  SELECT COALESCE(array_agg(a.user_id), '{}') INTO v_valides
  FROM public._presents_autour(p_id) a
  WHERE a.user_id = ANY (COALESCE(p_compagnons, '{}')) AND a.user_id <> v_moi;
  IF cardinality(v_valides) > 0 AND v_nom IS NULL THEN
    RAISE EXCEPTION 'Nom d''expédition manquant' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_valides) = 0 THEN
    v_nom := NULL; -- seul : la pilule porte son nom
  END IF;

  -- 422 : « pour » une Compagnie dont je suis membre seulement.
  IF v_pour IS NOT NULL AND public._role_compagnie(v_pour, v_moi) IS NULL THEN
    RAISE EXCEPTION 'Pas membre de cette Compagnie' USING ERRCODE = 'P0001', HINT = 'role';
  END IF;

  -- Déjà tenant, seul : on rafraîchit la date, sans nouvelle expédition (comme la V1).
  IF cardinality(v_valides) = 0 AND EXISTS (
    SELECT 1 FROM place_veille v
    WHERE v.place_id = p_id
      AND (v.veilleur_user_id = v_moi
        OR EXISTS (SELECT 1 FROM expedition_members m WHERE m.expedition_id = v.expedition_id AND m.user_id = v_moi))) THEN
    UPDATE place_veille SET planted_at = now(), pour_compagnie = COALESCE(v_pour, pour_compagnie) WHERE place_id = p_id;
    UPDATE expeditions SET pour_compagnie = COALESCE(v_pour, pour_compagnie)
    WHERE id = (SELECT expedition_id FROM place_veille WHERE place_id = p_id);
    RETURN json_build_object('nom', (
      SELECT COALESCE(NULLIF(x.title, ''), user_public_name(u.id, u.display_name, u.first_name))
      FROM place_veille v LEFT JOIN expeditions x ON x.id = v.expedition_id LEFT JOIN users u ON u.id = v_moi
      WHERE v.place_id = p_id));
  END IF;

  SELECT faction_id INTO v_faction FROM users WHERE id = v_moi;
  INSERT INTO expeditions (place_id, is_neutral, faction_id, title, pour_compagnie)
  VALUES (p_id, v_faction IS NULL, v_faction, v_nom, v_pour)
  RETURNING id INTO v_expedition;
  INSERT INTO expedition_members (expedition_id, user_id, faction_id)
  SELECT v_expedition, u.id, u.faction_id FROM users u WHERE u.id = ANY (v_valides || v_moi);

  INSERT INTO place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id, veilleur_user_id)
  VALUES (p_id, v_expedition, v_faction, v_faction IS NULL, now(), false, NULL, v_moi)
  ON CONFLICT (place_id) DO UPDATE SET
    expedition_id = EXCLUDED.expedition_id, faction_id = EXCLUDED.faction_id,
    is_neutral = EXCLUDED.is_neutral, planted_at = now(), by_influence = false,
    previous_expedition_id = NULL, veilleur_user_id = v_moi, pour_compagnie = v_pour;

  -- La Cour V1 repart de zéro, avec le bonus de plantage de la V1 : on ne reprend pas à distance
  -- un lieu revendiqué sur place (Uriel, 28/09). Pas de ligne veille_history : une revendication
  -- faite dans Explore ne compte pas en V1 (ni Gloire, ni Coupe, ni titres, ni classement).
  v_bonus := COALESCE((SELECT value::integer FROM app_settings WHERE key = 'plant_flag_solo_bonus'), 50)
    + COALESCE((SELECT value::integer FROM app_settings WHERE key = 'plant_flag_per_extra_member'), 30)
      * LEAST(cardinality(v_valides), COALESCE((SELECT value::integer FROM app_settings WHERE key = 'plant_flag_max_members_for_bonus'), 10));
  DELETE FROM place_court_action WHERE place_id = p_id AND beneficiary_user_id IS DISTINCT FROM v_moi;
  INSERT INTO place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
  VALUES (p_id, v_moi, v_expedition, v_moi, 'plant_bonus', v_bonus);
  DELETE FROM place_court_score WHERE place_id = p_id;

  RETURN json_build_object('nom', COALESCE(v_nom,
    (SELECT user_public_name(u.id, u.display_name, u.first_name) FROM users u WHERE u.id = v_moi)));
END;
$function$;

REVOKE ALL ON FUNCTION public.revendiquer_lieu(text, text[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revendiquer_lieu(text, text[], text, text) TO authenticated;

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
        'depuis', v.planted_at,
        -- 422 : « pour Le Lys de Fer ».
        'pourCompagnie', (SELECT json_build_object('id', f.id, 'nom', f.title, 'couleur', f.color)
                          FROM factions f WHERE f.id = v.pour_compagnie AND NOT f.retired))
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
        -- 418 : une origine sans récit ne crédite pas (le lieu posé sans texte, décrit par un autre).
        WHERE w.auteur IS NOT NULL
          AND ((w.precedente IS NULL AND w.recit <> '') OR w.recit IS DISTINCT FROM w.recit_avant)
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

CREATE OR REPLACE FUNCTION public.get_profil_explorateur(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  u public.users%ROWTYPE;
  v_moi boolean;
  v_attache json;
  v_departement text;
  v_pays text;
BEGIN
  SELECT * INTO u FROM public.users WHERE id = p_user_id AND is_active IS NOT FALSE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_moi := COALESCE((auth.uid())::text = p_user_id, false);

  -- « Noble représentant … » : le département (ou le pays) le plus visité, et sa silhouette.
  -- 406 : « représentante » pour qui a choisi le féminin (title_gender = 'f').
  IF u.show_departement OR v_moi THEN
    SELECT p.departement, p.pays
      INTO v_departement, v_pays
      FROM public.place_explorers e JOIN public.places p ON p.id = e.place_id
     WHERE e.user_id = p_user_id AND COALESCE(p.departement, p.pays) IS NOT NULL
       AND (v_moi OR (p.masked IS NOT TRUE AND p.private IS NOT TRUE))
     GROUP BY p.departement, p.pays
     ORDER BY count(*) DESC, max(e.visited_at) DESC
     LIMIT 1;

    IF v_departement IS NOT NULL THEN
      SELECT json_build_object('texte', 'Noble ' || CASE WHEN u.title_gender = 'f'
                                 THEN 'représentante ' ELSE 'représentant ' END || d.de_nom,
                               'silhouette', public._silhouette(d.geom))
        INTO v_attache
        FROM public.geo_departements d WHERE d.nom = v_departement;
    ELSIF v_pays IS NOT NULL THEN
      v_attache := json_build_object(
        'texte', 'Noble ' || CASE WHEN u.title_gender = 'f' THEN 'représentante' ELSE 'représentant' END
                 || ' · ' || v_pays,
        'silhouette', (SELECT public._silhouette(g.geom) FROM public.geo_pays g WHERE g.nom_fr = v_pays));
    END IF;
  END IF;

  RETURN (
    WITH lieux_montrables AS (
      SELECT id, title, images, author_id FROM public.places
       WHERE v_moi OR (masked IS NOT TRUE AND private IS NOT TRUE)
    ),
    ajoutes AS (
      SELECT l.id, l.title, l.images FROM lieux_montrables l WHERE l.author_id = p_user_id
    ),
    visites AS (
      SELECT DISTINCT ON (l.id) l.id, l.title, l.images, e.visited_at FROM public.place_explorers e
        JOIN lieux_montrables l ON l.id = e.place_id
       WHERE e.user_id = p_user_id AND l.id NOT IN (SELECT id FROM ajoutes)
       ORDER BY l.id, e.visited_at DESC
    ),
    envies AS (
      SELECT l.id, l.title, l.images, w.created_at FROM public.place_wishlist w
        JOIN lieux_montrables l ON l.id = w.place_id
       WHERE w.user_id = p_user_id
         AND l.id NOT IN (SELECT id FROM ajoutes) AND l.id NOT IN (SELECT id FROM visites)
    )
    SELECT json_build_object(
      'id', u.id,
      'nom', COALESCE(NULLIF(u.display_name, ''), NULLIF(u.first_name, ''), 'Explorateur'),
      'avatarUrl', u.avatar_url,
      'niveau', public._level_from_xp(COALESCE(u.xp_total, 0)),
      'titres', COALESCE((
        SELECT json_agg(json_build_object('id', g.id, 'nom', g.name, 'condition', g.condition) ORDER BY g.ord)
          FROM (SELECT t.id, t.name, t.condition, x.ord
                  FROM unnest(u.displayed_title_ids_v3) WITH ORDINALITY AS x(tid, ord)
                  JOIN public.titles t ON t.id = x.tid AND t.type = 'general'
                 ORDER BY x.ord
                 LIMIT 3) g), '[]'::json),
      'signe', (
        SELECT json_build_object('id', tf.id, 'nom', tf.name, 'imageUrl', COALESCE(tf.image_url, tf.icon_url))
          FROM public.title_fragments tf
         WHERE tf.id = u.signe_fragment_id AND tf.visible
           AND EXISTS (SELECT 1 FROM public.user_fragments f
                        WHERE f.user_id = p_user_id AND f.fragment_id = tf.id)),
      'bio', NULLIF(u.bio, ''),
      'instagram', NULLIF(u.instagram, ''),
      'inscritLe', u.created_at,
      'porteurVerifie', EXISTS (SELECT 1 FROM public.user_fragments f
                                  JOIN public.title_fragments tf ON tf.id = f.fragment_id AND tf.visible
                                 WHERE f.user_id = p_user_id),
      'role', CASE WHEN u.role IN ('admin', 'moderator') THEN u.role END,
      'attache', v_attache,
      'fragments', COALESCE((
        SELECT json_agg(json_build_object('id', tf.id, 'nom', tf.name, 'imageUrl', COALESCE(tf.image_url, tf.icon_url)) ORDER BY f.unlocked_at)
          FROM public.user_fragments f JOIN public.title_fragments tf ON tf.id = f.fragment_id
         WHERE f.user_id = p_user_id AND tf.visible), '[]'::json),
      -- Seulement sur son propre profil : combien de Fragments restent à découvrir. Chez les
      -- autres, rien (on n'affiche jamais ce qu'un Explorateur n'a pas acheté).
      'fragmentsADecouvrir', CASE WHEN v_moi THEN (
        SELECT count(*) FROM public.title_fragments tf
         WHERE tf.visible
           AND NOT EXISTS (SELECT 1 FROM public.user_fragments f
                            WHERE f.user_id = p_user_id AND f.fragment_id = tf.id)) END,
      'ajoutes', COALESCE((SELECT json_agg(public._carte_lieu(a.id) ORDER BY p.created_at DESC)
                             FROM ajoutes a JOIN public.places p ON p.id = a.id), '[]'::json),
      'visites', COALESCE((SELECT json_agg(public._carte_lieu(id) ORDER BY visited_at DESC) FROM visites), '[]'::json),
      'envies', CASE WHEN u.show_envies OR v_moi THEN
                  COALESCE((SELECT json_agg(public._carte_lieu(id) ORDER BY created_at DESC) FROM envies), '[]'::json)
                END,
      -- 422 : ses Compagnies (une privée : pour lui-même, ou pour un autre membre).
      'compagnies', COALESCE((SELECT json_agg(json_build_object('id', f.id, 'nom', f.title, 'couleur', f.color) ORDER BY f.title)
        FROM faction_members m JOIN factions f ON f.id = m.faction_id
        WHERE m.user_id = p_user_id AND NOT f.retired
          AND (NOT f.privee OR v_moi OR public._role_compagnie(f.id, (auth.uid())::text) IS NOT NULL)), '[]'::json),
      'estMoi', v_moi
    )
  );
END;
$function$;
