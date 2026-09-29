-- WHY: le « Carnet de passage » (maquette Figma « Lieu — le carnet de passage (sur la fiche) »,
--      validée par Uriel le 30/09) : les commentaires reviennent sous la fiche. Ce sont ceux de la
--      V1 (place_contributions type 'comment', 62 mots dont 10 réponses) : rien ne se perd.
--   1. coeurs_mot : des cœurs à volonté sur un mot, comme sur un lieu (384) ; les 22 « j'aime »
--      de la V1 sur des commentaires y entrent comme un premier cœur.
--   2. carnet_du_lieu(p_id, p_limite) : les mots, du plus récent au plus ancien (p_limite : les
--      premiers seulement, pour la fiche), chacun avec ses réponses (un seul niveau, dans
--      l'ordre), qui, « est venu·e » (a visité le lieu), ses photos, ses cœurs, les miens, et s'il
--      est à moi.
--   3. ecrire_au_carnet(p_id, p_texte, p_images, p_parent) : qui a découvert le lieu, son auteur,
--      l'équipe — comme Modifier. Un mot de 1 à 2000 signes, jusqu'à quatre photos (mêmes
--      contrôles que l'ajout d'un lieu : le dossier du compte, le fichier existe) ; une réponse à
--      une réponse va sous le mot d'origine (un seul niveau). Trente mots par jour. L'auteur du
--      lieu est prévenu (« new_comment »), et celui à qui l'on répond (« comment_reply »).
--   4. aimer_mot(p_id) : un cœur de plus ; pas sur son propre mot. Le premier cœur d'une personne
--      prévient l'auteur du mot (« coeur_mot »).
--   5. effacer_mot(p_id) : son auteur ou l'équipe ; ses réponses partent avec lui (cascade).
--   6. _notification_v2 : « coeur_mot » rejoint les Notifications de la V2.
-- SCHEMA CHECKED (30/09/2026, information_schema et contraintes live) : place_contributions(id int,
--      place_id varchar, user_id varchar, type text ('comment'), content text, images jsonb
--      [adresses], parent_id int → place_contributions ON DELETE CASCADE, created_at,
--      updated_at) ; contribution_votes(contribution_id, user_id, vote smallint, created_at) ;
--      place_explorers(place_id, user_id) ; places_discovered(place_id, user_id) ;
--      activity_log(type, actor_id, place_id, data) ; storage.objects(bucket_id, name) ;
--      notify(text, text, jsonb) ; _lieu_visible(text) ; _is_staff() ; user_public_name(...).

CREATE TABLE public.coeurs_mot (
  contribution_id integer NOT NULL REFERENCES public.place_contributions(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nombre int NOT NULL DEFAULT 1 CHECK (nombre > 0),
  premier_le timestamptz NOT NULL DEFAULT now(),
  dernier_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contribution_id, user_id)
);
ALTER TABLE public.coeurs_mot ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coeurs_mot FROM PUBLIC, anon, authenticated;

INSERT INTO public.coeurs_mot (contribution_id, user_id, nombre, premier_le, dernier_le)
SELECT v.contribution_id, v.user_id, 1, v.created_at, v.created_at
FROM contribution_votes v
JOIN place_contributions c ON c.id = v.contribution_id
JOIN users u ON u.id = v.user_id
WHERE c.type = 'comment' AND v.vote = 1 AND v.user_id <> c.user_id
ON CONFLICT DO NOTHING;

-- Un mot, tel que le carnet le montre.
CREATE OR REPLACE FUNCTION public._mot(p_id integer)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'id', c.id,
    'quand', c.created_at,
    'texte', c.content,
    'qui', json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
                             'avatar', u.avatar_url),
    'venu', EXISTS (SELECT 1 FROM place_explorers e WHERE e.place_id = c.place_id AND e.user_id = c.user_id),
    'photos', COALESCE((SELECT json_agg(COALESCE(i->>'url', i #>> '{}'))
                        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c.images) = 'array'
                                                       THEN c.images ELSE '[]'::jsonb END) i), '[]'::json),
    'coeurs', (SELECT COALESCE(sum(nombre), 0) FROM coeurs_mot WHERE contribution_id = c.id),
    'miens', (SELECT COALESCE(sum(nombre), 0) FROM coeurs_mot
              WHERE contribution_id = c.id AND user_id = (auth.uid())::text),
    'aMoi', c.user_id = (auth.uid())::text)
  FROM place_contributions c JOIN users u ON u.id = c.user_id
  WHERE c.id = p_id;
$function$;
REVOKE ALL ON FUNCTION public._mot(integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.carnet_du_lieu(p_id text, p_limite integer DEFAULT NULL)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN NOT public._lieu_visible(p_id) THEN NULL ELSE json_build_object(
    'total', (SELECT count(*) FROM place_contributions WHERE place_id = p_id AND type = 'comment'),
    'mots', COALESCE((
      SELECT json_agg(m.mot ORDER BY m.created_at DESC)
      FROM (
        SELECT c.created_at,
               (public._mot(c.id)::jsonb || jsonb_build_object('reponses', COALESCE((
                  SELECT jsonb_agg(public._mot(r.id)::jsonb ORDER BY r.created_at)
                  FROM place_contributions r WHERE r.parent_id = c.id AND r.type = 'comment'), '[]'::jsonb)))::json AS mot
        FROM place_contributions c
        WHERE c.place_id = p_id AND c.type = 'comment' AND c.parent_id IS NULL
        ORDER BY c.created_at DESC
        LIMIT least(COALESCE(p_limite, 100), 100)
      ) m), '[]'::json)
  ) END;
$function$;
REVOKE ALL ON FUNCTION public.carnet_du_lieu(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.carnet_du_lieu(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.ecrire_au_carnet(
  p_id text,
  p_texte text,
  p_images jsonb DEFAULT '[]'::jsonb,
  p_parent integer DEFAULT NULL
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_texte text := btrim(p_texte);
  v_images jsonb := COALESCE(p_images, '[]'::jsonb);
  v_auteur text;
  v_titre text;
  v_parent integer := p_parent;
  v_parent_de_parent integer;
  v_auteur_parent text;
  v_dossier text;
  v_fichier text;
  v_image jsonb;
  v_adresses jsonb := '[]'::jsonb;
  v_id integer;
  v_nom text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT public._lieu_visible(p_id) THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  SELECT author_id, title INTO v_auteur, v_titre FROM places WHERE id = p_id;
  IF v_auteur IS DISTINCT FROM v_moi AND NOT public._is_staff()
     AND NOT EXISTS (SELECT 1 FROM places_discovered WHERE place_id = p_id AND user_id = v_moi) THEN
    RAISE EXCEPTION 'Découvre ce lieu avant d’y laisser un mot' USING ERRCODE = 'P0001', HINT = 'decouvrir';
  END IF;
  IF v_texte IS NULL OR char_length(v_texte) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Un mot de 1 à 2000 signes' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_images) <> 'array' OR jsonb_array_length(v_images) > 4 THEN
    RAISE EXCEPTION 'Quatre photos au plus' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM place_contributions
      WHERE user_id = v_moi AND type = 'comment' AND created_at > now() - interval '1 day') >= 30 THEN
    RAISE EXCEPTION 'Trente mots aujourd’hui : reviens demain' USING ERRCODE = 'P0001', HINT = 'limite';
  END IF;

  -- Une réponse à une réponse va sous le mot d'origine : un seul niveau.
  IF v_parent IS NOT NULL THEN
    SELECT parent_id, user_id INTO v_parent_de_parent, v_auteur_parent FROM place_contributions
    WHERE id = v_parent AND place_id = p_id AND type = 'comment';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ce mot n’existe plus' USING ERRCODE = 'P0002';
    END IF;
    IF v_parent_de_parent IS NOT NULL THEN
      v_parent := v_parent_de_parent;
    END IF;
  END IF;

  -- Les photos : les mêmes contrôles qu'à l'ajout d'un lieu (381).
  v_dossier := 'https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/place-images/places/'
               || v_moi || '/';
  FOR v_image IN SELECT * FROM jsonb_array_elements(v_images) LOOP
    v_fichier := substr(coalesce(v_image->>'url', ''), length(v_dossier) + 1);
    IF left(coalesce(v_image->>'url', ''), length(v_dossier)) <> v_dossier
       OR v_fichier !~ '^[A-Za-z0-9-]+\.webp$' THEN
      RAISE EXCEPTION 'Photo hors de ton dossier' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM storage.objects o
                   WHERE o.bucket_id = 'place-images' AND o.name = 'places/' || v_moi || '/' || v_fichier) THEN
      RAISE EXCEPTION 'Photo introuvable' USING ERRCODE = '22023';
    END IF;
    v_adresses := v_adresses || to_jsonb(v_dossier || v_fichier);
  END LOOP;

  INSERT INTO place_contributions (place_id, user_id, type, content, images, parent_id, created_at, updated_at)
  VALUES (p_id, v_moi, 'comment', v_texte, v_adresses, v_parent, now(), now())
  RETURNING id INTO v_id;

  SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom FROM users u WHERE u.id = v_moi;
  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES ('contribute', v_moi, p_id, jsonb_build_object(
    'contributionType', 'comment', 'placeTitle', v_titre, 'actorName', v_nom, 'fromV2', true));

  -- L'auteur du lieu, et celui à qui l'on répond ; un échec ici n'empêche pas le mot de partir.
  BEGIN
    IF v_auteur IS NOT NULL AND v_auteur <> v_moi AND v_auteur IS DISTINCT FROM v_auteur_parent THEN
      PERFORM notify(v_auteur, 'new_comment', jsonb_build_object(
        'actorName', v_nom, 'actorId', v_moi, 'placeTitle', v_titre, 'placeId', p_id, 'contributionId', v_id));
    END IF;
    IF v_auteur_parent IS NOT NULL AND v_auteur_parent <> v_moi THEN
      PERFORM notify(v_auteur_parent, 'comment_reply', jsonb_build_object(
        'actorName', v_nom, 'actorId', v_moi, 'placeTitle', v_titre, 'placeId', p_id, 'contributionId', v_id));
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'ecrire_au_carnet : notification en échec (%)', SQLERRM;
  END;

  RETURN json_build_object('id', v_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.ecrire_au_carnet(text, text, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ecrire_au_carnet(text, text, jsonb, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.aimer_mot(p_id integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_auteur text;
  v_lieu text;
  v_nombre int;
  v_nom text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT user_id, place_id INTO v_auteur, v_lieu FROM place_contributions WHERE id = p_id AND type = 'comment';
  IF NOT FOUND OR NOT public._lieu_visible(v_lieu) THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_auteur = v_moi THEN
    RAISE EXCEPTION 'On ne s’envoie pas de cœurs' USING ERRCODE = '22023';
  END IF;

  INSERT INTO coeurs_mot (contribution_id, user_id) VALUES (p_id, v_moi)
  ON CONFLICT (contribution_id, user_id)
    DO UPDATE SET nombre = coeurs_mot.nombre + 1, dernier_le = now()
  RETURNING nombre INTO v_nombre;

  -- Le premier cœur de quelqu'un prévient l'auteur du mot ; les suivants, non.
  IF v_nombre = 1 THEN
    BEGIN
      SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom FROM users u WHERE u.id = v_moi;
      PERFORM notify(v_auteur, 'coeur_mot', jsonb_build_object(
        'actorName', v_nom, 'actorId', v_moi, 'placeId', v_lieu, 'contributionId', p_id));
    EXCEPTION WHEN others THEN
      RAISE WARNING 'aimer_mot : notification en échec (%)', SQLERRM;
    END;
  END IF;

  RETURN json_build_object(
    'coeurs', (SELECT COALESCE(sum(nombre), 0) FROM coeurs_mot WHERE contribution_id = p_id),
    'miens', v_nombre);
END;
$function$;
REVOKE ALL ON FUNCTION public.aimer_mot(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aimer_mot(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.effacer_mot(p_id integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_auteur text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT user_id INTO v_auteur FROM place_contributions WHERE id = p_id AND type = 'comment';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_auteur <> v_moi AND NOT public._is_staff() THEN
    RAISE EXCEPTION 'Seul son auteur peut effacer ce mot' USING ERRCODE = '42501';
  END IF;
  DELETE FROM place_contributions WHERE id = p_id;
  RETURN json_build_object('ok', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.effacer_mot(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.effacer_mot(integer) TO authenticated;

-- « coeur_mot » rejoint les Notifications de la V2 (liste copiée de la 387).
CREATE OR REPLACE FUNCTION public._notification_v2(p_type text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT p_type = ANY (ARRAY[
    'like_contribution', 'like_carnet', 'new_carnet', 'description_edited', 'new_photo',
    'new_comment', 'comment_reply', 'place_position_edited', 'exploration',
    'milestone_vues', 'milestone_exploration', 'milestone_likes', 'mention', 'salut',
    'lieu_modifie', 'coeur_mot']);
$function$;
