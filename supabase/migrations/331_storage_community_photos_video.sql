-- 331_storage_community_photos_video.sql
-- WHY : le studio public de soumission (apps/hub StudioSubmit.tsx, /soumettre-contenu)
-- invite explicitement des VIDÉOS (`accept="video/*"`, jusqu'à 50 Mo) et des images
-- jusqu'à 15 Mo (limite client remontée 10→15 Mo, commit 9e1d012). Or le bucket
-- community-photos refusait tout ça :
--   - allowed_mime_types = images seulement (aucun mime vidéo)
--   - RLS INSERT (policy "Authenticated can upload community-photos") = extensions
--     images seulement → mp4/mov rejetés
--   - file_size_limit = 10 Mo < 15 Mo (images) et < 50 Mo (vidéos)
-- Conséquence : l'upload jetait, la ligne hub_photo_submissions (créée AVANT la boucle
-- d'upload) restait VIDE, et l'utilisateur réessayait en boucle → soumissions vides en
-- rafale (Pierrick 3×, Ayden 3×, Vincent 3×), aucune image reçue.
--
-- Décision (Uriel, 2026-07-07) : on SUPPORTE les vidéos. On aligne donc le bucket +
-- la policy RLS sur ce que le studio autorise déjà. ADDITIF (on n'enlève aucun format).
--
-- NB : la robustification client (upload-first + try/catch par fichier, plus d'orpheline)
-- vit dans apps/hub/src/components/StudioSubmit.tsx — cette migration suffit à réparer
-- le symptôme en prod même sans redéploiement du client.

BEGIN;

-- 1. Bucket : accepter les mimes vidéo + monter la limite à 50 Mo (couvre images 15 Mo
--    et vidéos 50 Mo, la limite est globale au bucket).
UPDATE storage.buckets
SET file_size_limit  = 52428800,  -- 50 Mo
    allowed_mime_types = ARRAY[
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'video/mp4', 'video/quicktime', 'video/webm'
    ]
WHERE id = 'community-photos';

-- 2. Policy RLS INSERT : ajouter les extensions vidéo au garde-fou d'extension
--    (base = def LIVE : bucket + jpg/jpeg/png/webp/heic/heif).
ALTER POLICY "Authenticated can upload community-photos"
  ON storage.objects
  WITH CHECK (
    (bucket_id = 'community-photos'::text)
    AND (lower(storage.extension(name)) = ANY (ARRAY[
      'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif',
      'mp4', 'mov', 'webm', 'm4v'
    ]))
  );

COMMIT;
