-- WHY: une photo laissée dans un mot du carnet est une photo du lieu (Uriel, 22/10), comme une photo
--      ajoutée depuis la 536 : elle rejoint places.images et peut devenir la couverture. Jusqu'ici
--      elle ne vivait que dans le mot (60 photos, 27 mots, 26 lieux).
--   1. ecrire_au_carnet : copiée de la définition live ; les adresses rejoignent aussi
--      places.images, à la suite, dans la limite des trente photos du lieu — au-delà, la photo
--      reste dans le mot seulement. Le mot garde ses photos.
--   2. Effacer un mot retire ses photos du lieu (Uriel, 22/10). Un déclencheur, pas effacer_mot :
--      les réponses partent en cascade avec leur mot (parent_id ON DELETE CASCADE), et les mots
--      d'un compte supprimé aussi (user_id ON DELETE CASCADE) — tous passent par lui.
--   3. Rattrapage : les photos des mots absentes de places.images y entrent, à la suite, dans
--      l'ordre des mots. Aucun lieu ne dépasse alors trente (vérifié le 22/10 : 10 + 1 au plus).
--   Une photo de mot n'a pas de vignette : thumb null, les lectures prennent l'url (COALESCE).
-- SCHEMA CHECKED (22/10/2026, live) : places.images [{id,url,thumb}] ; place_contributions type
--   'comment', images [adresses en chaînes] (aucun objet) ; ecrire_au_carnet(text,text,jsonb,
--   integer) copiée de sa définition live ; seuls trg_xp_contribution_ins/_del sur la table.

CREATE OR REPLACE FUNCTION public.ecrire_au_carnet(p_id text, p_texte text, p_images jsonb DEFAULT '[]'::jsonb, p_parent integer DEFAULT NULL::integer)
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

  -- Une photo du carnet est une photo du lieu (mig 538), tant qu'il reste de la place sur trente.
  UPDATE places
     SET images = CASE WHEN jsonb_typeof(images) = 'array' THEN images ELSE '[]'::jsonb END
                  || COALESCE((SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid()::text, 'url', a #>> '{}', 'thumb', NULL))
                                 FROM (SELECT a FROM jsonb_array_elements(v_adresses) WITH ORDINALITY AS x(a, o)
                                        ORDER BY o
                                        LIMIT greatest(0, 30 - json_array_length(public._photos_du_lieu(p_id)))) s),
                              '[]'::jsonb)
   WHERE id = p_id AND jsonb_array_length(v_adresses) > 0;

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

-- Un mot effacé emporte ses photos du lieu.
CREATE FUNCTION public._trg_mot_retire_ses_photos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE places
     SET images = COALESCE((SELECT jsonb_agg(i ORDER BY o)
                              FROM jsonb_array_elements(images) WITH ORDINALITY AS x(i, o)
                             WHERE NOT OLD.images ? (i->>'url')), '[]'::jsonb)
   WHERE id = OLD.place_id AND jsonb_typeof(images) = 'array';
  RETURN NULL;
END;
$function$;

ALTER FUNCTION public._trg_mot_retire_ses_photos() OWNER TO postgres;
REVOKE ALL ON FUNCTION public._trg_mot_retire_ses_photos() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_mot_retire_ses_photos
  AFTER DELETE ON public.place_contributions
  FOR EACH ROW
  WHEN (OLD.type = 'comment' AND jsonb_typeof(OLD.images) = 'array' AND jsonb_array_length(OLD.images) > 0)
  EXECUTE FUNCTION public._trg_mot_retire_ses_photos();

-- Rattrapage
WITH photos_des_mots AS (
  SELECT c.place_id, e #>> '{}' AS url, c.created_at AS quand, x.o AS ordre
    FROM place_contributions c,
         jsonb_array_elements(c.images) WITH ORDINALITY AS x(e, o)
   WHERE c.type = 'comment' AND jsonb_typeof(c.images) = 'array'
), manquants AS (
  SELECT m.place_id,
         jsonb_agg(jsonb_build_object('id', gen_random_uuid()::text, 'url', m.url, 'thumb', NULL)
                   ORDER BY m.quand, m.ordre) AS images
    FROM photos_des_mots m JOIN places p ON p.id = m.place_id
   WHERE m.url IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.images) = 'array' THEN p.images ELSE '[]'::jsonb END) i
                      WHERE i->>'url' = m.url)
   GROUP BY m.place_id
)
UPDATE places p
   SET images = CASE WHEN jsonb_typeof(p.images) = 'array' THEN p.images ELSE '[]'::jsonb END || m.images
  FROM manquants m
 WHERE m.place_id = p.id;
