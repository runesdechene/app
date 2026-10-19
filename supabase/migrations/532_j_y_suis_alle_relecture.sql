-- WHY: Suites de la relecture de « J'y suis allé » (531, 19/10/2026).
--      1. Le Panthéon (grands_explorateurs, « visites ») comptait les souvenirs : on pouvait le gonfler
--         sans sortir de chez soi. Il ne compte plus que les visites GPS, comme les titres.
--      2. Un souvenir du mois en cours déclaré le 1er avant midi recevait une date de visite dans le
--         futur : elle est plafonnée à maintenant.
--      3. Le passeport dit si la date d'un tampon n'est connue qu'au mois (auMois : un souvenir, même
--         devenu visite GPS) : l'écran n'affiche alors pas « 1er août 2019 ».
-- SCHEMA CHECKED (19/10/2026, live) : les trois fonctions copiées de pg_get_functiondef après la 531 ;
--   seul le delta change. schema_migrations s'arrête à 531 : 532 est libre.


CREATE OR REPLACE FUNCTION public.grands_explorateurs(p_type text DEFAULT 'visites'::text, p_periode text DEFAULT '30jours'::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      WHERE p_type = 'visites' AND e.visited_at >= v_debut AND NOT e.a_distance -- 532 : sur place seulement
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
$function$;

CREATE OR REPLACE FUNCTION public.declarer_souvenir(p_id text, p_annee integer, p_mois integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_le date;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT public._lieu_visible(p_id) THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM places WHERE id = p_id AND author_id = v_moi)
     AND NOT EXISTS (SELECT 1 FROM places_discovered WHERE place_id = p_id AND user_id = v_moi) THEN
    RAISE EXCEPTION 'Découvre ce lieu d''abord' USING ERRCODE = 'P0001', HINT = 'decouvrir';
  END IF;
  IF p_mois IS NULL OR p_annee IS NULL OR p_mois NOT BETWEEN 1 AND 12 OR p_annee < 1900 THEN
    RAISE EXCEPTION 'Date invalide' USING ERRCODE = '22023';
  END IF;
  v_le := make_date(p_annee, p_mois, 1);
  IF v_le > date_trunc('month', now() AT TIME ZONE 'Europe/Paris')::date THEN
    RAISE EXCEPTION 'Date à venir' USING ERRCODE = '22023', HINT = 'futur';
  END IF;

  INSERT INTO place_explorers (place_id, user_id, visited_at, a_distance, souvenir_le, declare_le)
  VALUES (p_id, v_moi, LEAST((v_le + time '12:00') AT TIME ZONE 'Europe/Paris', now()), true, v_le, now()) -- 532
  ON CONFLICT (place_id, user_id) DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Déjà visité' USING ERRCODE = 'P0001', HINT = 'deja';
  END IF;

  -- L'auteur du lieu l'apprend dans la cloche (jamais par push : send-push ne connaît pas ce type).
  BEGIN
    PERFORM notify(p.author_id, 'souvenir', jsonb_build_object(
      'actorId', v_moi,
      'actorName', (SELECT user_public_name(u.id, u.display_name, u.first_name) FROM users u WHERE u.id = v_moi),
      'placeId', p_id,
      'placeTitle', p.title,
      'souvenirLe', to_char(v_le, 'YYYY-MM-DD')))
    FROM places p WHERE p.id = p_id AND p.author_id IS DISTINCT FROM v_moi;
  EXCEPTION WHEN others THEN RAISE WARNING 'declarer_souvenir : notification en échec (%)', SQLERRM;
  END;

  RETURN json_build_object('souvenirLe', to_char(v_le, 'YYYY-MM-DD'));
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_passeport(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND is_active IS NOT FALSE) THEN
    RETURN NULL;
  END IF;
  v_moi := COALESCE((auth.uid())::text = p_user_id, false);

  RETURN (
    WITH premieres AS (
      -- 531 : un souvenir prend son mois, et le garde après la visite GPS (la date d'origine).
      SELECT e.place_id,
             min(CASE WHEN e.souvenir_le IS NOT NULL THEN (e.souvenir_le + time '12:00') AT TIME ZONE 'Europe/Paris'
                      ELSE e.visited_at END) AS premiere,
             bool_or(e.a_distance) AS a_distance,
             bool_or(e.souvenir_le IS NOT NULL) AS au_mois -- 532
        FROM public.place_explorers e JOIN public.places p ON p.id = e.place_id
       WHERE e.user_id = p_user_id
         AND (v_moi OR (p.masked IS NOT TRUE AND p.private IS NOT TRUE))
       GROUP BY e.place_id
    )
    SELECT json_build_object(
      'auJour', v_moi,
      'natures', COALESCE((
        SELECT json_agg(json_build_object('id', t.id, 'nom', t.title, 'icone', t.icon, 'couleur', t.color)
                        ORDER BY t."order", t.title)
          FROM public.tags t), '[]'::json),
      'tampons', COALESCE((
        SELECT json_agg(json_build_object(
                 'id', p.id,
                 'nom', p.title,
                 'imageUrl', p.images -> 0 ->> 'url',
                 'nature', (SELECT pt.tag_id FROM public.place_tags pt
                             WHERE pt.place_id = p.id AND pt.is_primary LIMIT 1),
                 'departement', p.departement,
                 'pays', p.pays,
                 'quand', to_char(
                   CASE WHEN v_moi THEN (pr.premiere AT TIME ZONE 'Europe/Paris')
                        ELSE date_trunc('month', pr.premiere AT TIME ZONE 'Europe/Paris') END,
                   'YYYY-MM-DD'),
                 'aDistance', pr.a_distance, -- 531
                 'auMois', pr.au_mois) -- 532 : une date connue au mois seulement
               ORDER BY pr.premiere DESC)
          FROM premieres pr JOIN public.places p ON p.id = pr.place_id), '[]'::json)
    )
  );
END;
$function$;
