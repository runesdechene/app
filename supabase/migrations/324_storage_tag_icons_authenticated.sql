-- 324_storage_tag_icons_authenticated.sql
-- WHY : complément de 323. Trois policies storage.objects sur le bucket tag-icons
-- (« Authenticated upload/update/delete tag-icons ») étaient en réalité `TO public`
-- sans aucune garde auth dans l'expression (juste bucket_id = 'tag-icons') → anon
-- pouvait uploader/écraser/supprimer les icônes de tags. Le nom « Authenticated »
-- était trompeur (rôle réel = public).
--
-- tag-icons n'est écrit que par le hub (TagsManager), en utilisateur connecté →
-- retarget de `public` vers `authenticated` : ferme l'écriture anon, hub intact.
-- Après cette migration, plus aucune policy d'écriture storage n'est ouverte à anon.
-- ADDITIF.

BEGIN;

ALTER POLICY "Authenticated upload tag-icons" ON storage.objects TO authenticated; -- INSERT
ALTER POLICY "Authenticated update tag-icons" ON storage.objects TO authenticated; -- UPDATE
ALTER POLICY "Authenticated delete tag-icons" ON storage.objects TO authenticated; -- DELETE

COMMIT;
