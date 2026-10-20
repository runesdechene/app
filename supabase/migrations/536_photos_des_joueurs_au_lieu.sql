-- WHY: « tous les joueurs sont en partie les créateurs d'un lieu » (Uriel, 20/10) — or depuis juin, une
--      photo ajoutée par un joueur ne vivait que dans place_contributions : la fiche la montrait, mais
--      elle ne pouvait jamais devenir la couverture (carte, Près de moi, accueil, chemins, passeport,
--      Hub), toutes lues dans places.images. 174 photos dans l'ombre ; 5 lieux sans couverture alors
--      qu'ils ont des photos. On revient à la règle de la V1 (jusqu'au 28/03) : une photo ajoutée est
--      une photo du lieu.
--   1. ajouter_photos_lieu : copiée de la définition live ; les adresses rejoignent aussi
--      places.images, à la suite. La ligne place_contributions reste la trace de qui (XP, chemins,
--      notification) — _photos_du_lieu ne liste pas deux fois une photo présente aux deux (mig 535).
--   2. Rattrapage : les photos ajoutées absentes de places.images y entrent, à la suite, dans l'ordre
--      de leur ajout. Les couvertures existantes ne bougent pas ; updated_at non plus (pas une
--      modification du lieu par quelqu'un).
--   Une photo ajoutée n'a pas de vignette : thumb null, les lectures prennent l'url (COALESCE).
-- SCHEMA CHECKED (20/10/2026, live) : places.images [{id,url,thumb}], aucun déclencheur sur sa mise
--   à jour ; place_contributions(id, place_id, type, images [adresses en chaînes], created_at) ;
--   ajouter_photos_lieu(text, jsonb) copiée de sa définition live ; modifier_lieu et
--   lieu_a_modifier n'écrivent pas places.images.

CREATE OR REPLACE FUNCTION public.ajouter_photos_lieu(p_id text, p_images jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_auteur text;
  v_titre text;
  v_dossier text;
  v_fichier text;
  v_nom_fichier text;
  v_image jsonb;
  v_adresses jsonb := '[]'::jsonb;
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
    RAISE EXCEPTION 'Découvre ce lieu avant d’y ajouter des photos' USING ERRCODE = 'P0001', HINT = 'decouvrir';
  END IF;
  IF p_images IS NULL OR jsonb_typeof(p_images) <> 'array' OR jsonb_array_length(p_images) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'De une à dix photos' USING ERRCODE = '22023';
  END IF;
  IF json_array_length(public._photos_du_lieu(p_id)) + jsonb_array_length(p_images) > 30 THEN
    RAISE EXCEPTION 'Trente photos par lieu au plus' USING ERRCODE = 'P0001', HINT = 'plein';
  END IF;
  IF (SELECT COALESCE(sum(jsonb_array_length(images)), 0) FROM place_contributions
      WHERE user_id = v_moi AND type = 'photo' AND created_at > now() - interval '1 day') >= 30 THEN
    RAISE EXCEPTION 'Trente photos aujourd’hui : reviens demain' USING ERRCODE = 'P0001', HINT = 'limite';
  END IF;

  -- Les mêmes contrôles qu'à l'ajout d'un lieu (381) : le dossier du compte, le fichier existe.
  v_dossier := 'https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/place-images/places/'
               || v_moi || '/';
  FOR v_image IN SELECT * FROM jsonb_array_elements(p_images) LOOP
    v_fichier := substr(coalesce(v_image->>'url', ''), length(v_dossier) + 1);
    IF left(coalesce(v_image->>'url', ''), length(v_dossier)) <> v_dossier
       OR v_fichier !~ '^[A-Za-z0-9-]+\.webp$' THEN
      RAISE EXCEPTION 'Photo hors de ton dossier' USING ERRCODE = '22023';
    END IF;
    v_nom_fichier := 'places/' || v_moi || '/' || v_fichier;
    IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'place-images' AND o.name = v_nom_fichier) THEN
      RAISE EXCEPTION 'Photo introuvable' USING ERRCODE = '22023';
    END IF;
    v_adresses := v_adresses || to_jsonb(v_dossier || v_fichier);
  END LOOP;

  -- Rangées comme en V1 : la V1 les voit aussi.
  INSERT INTO place_contributions (place_id, user_id, type, images, created_at, updated_at)
  VALUES (p_id, v_moi, 'photo', v_adresses, now(), now());

  -- Une photo ajoutée est une photo du lieu (mig 536) : elle peut devenir sa couverture.
  UPDATE places
     SET images = CASE WHEN jsonb_typeof(images) = 'array' THEN images ELSE '[]'::jsonb END
                  || (SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid()::text, 'url', a #>> '{}', 'thumb', NULL))
                        FROM jsonb_array_elements(v_adresses) a)
   WHERE id = p_id;

  SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom FROM users u WHERE u.id = v_moi;
  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES ('contribute', v_moi, p_id, jsonb_build_object(
    'contributionType', 'photo', 'placeTitle', v_titre, 'actorName', v_nom, 'fromV2', true));

  IF v_auteur IS NOT NULL AND v_auteur <> v_moi THEN
    BEGIN
      PERFORM notify(v_auteur, 'new_photo', jsonb_build_object(
        'actorName', v_nom, 'actorId', v_moi, 'placeTitle', v_titre, 'placeId', p_id));
    EXCEPTION WHEN others THEN
      RAISE WARNING 'ajouter_photos_lieu : notification en échec (%)', SQLERRM;
    END;
  END IF;

  RETURN json_build_object('photos', jsonb_array_length(v_adresses));
END;
$function$
;

-- Rattrapage
WITH ajouts AS (
  SELECT c.place_id, COALESCE(e->>'url', e #>> '{}') AS url, min(c.created_at) AS quand, min(x.o) AS ordre
    FROM place_contributions c,
         jsonb_array_elements(c.images) WITH ORDINALITY AS x(e, o)
   WHERE c.type = 'photo' AND jsonb_typeof(c.images) = 'array'
   GROUP BY 1, 2
), manquants AS (
  SELECT a.place_id,
         jsonb_agg(jsonb_build_object('id', gen_random_uuid()::text, 'url', a.url, 'thumb', NULL)
                   ORDER BY a.quand, a.ordre) AS images
    FROM ajouts a JOIN places p ON p.id = a.place_id
   WHERE a.url IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.images) = 'array' THEN p.images ELSE '[]'::jsonb END) i
                      WHERE i->>'url' = a.url)
   GROUP BY a.place_id
)
UPDATE places p
   SET images = CASE WHEN jsonb_typeof(p.images) = 'array' THEN p.images ELSE '[]'::jsonb END || m.images
  FROM manquants m
 WHERE m.place_id = p.id;
