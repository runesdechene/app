-- WHY: six règles du stockage, créées depuis le tableau de bord Supabase (« Allow all 1snxhtj_1/2/3 »,
--      « Enable storage 1lvpvk4_0/2/3 »), valent `true` pour tout compte connecté, dans TOUS les
--      seaux : n'importe qui pouvait déposer, écraser ou effacer n'importe quel fichier — les 13 000
--      photos des lieux, les avatars, les bannières (constat du 30/09, docs/v2/purge-back.md).
--      On les remplace par ce qu'elles couvraient vraiment, relevé dans le code le 30/09 :
--   • place-images : chacun dans ses dossiers — `places/<moi>/…` (photos d'un lieu, V1 et V2) et
--     `<moi>/…` (avatars). Déposer, remplacer (l'`upsert` de la V2 : une pose ratée se rejoue) et
--     effacer. Les admins partout (le tutoriel du Hub, `tutorial/…`, en `upsert`).
--   • faction-emblems : `factions/<compagnie>.webp`, par le chef de la Compagnie (V1) ou un admin.
--   • home-banners, app-ads, app-fragments : le Hub, donc les admins.
--      Les autres seaux gardent leurs propres règles, déjà limitées à leur seau.
--      La lecture ne change pas (seaux publics).
-- SCHEMA CHECKED (30/09/2026, pg_policies et storage.buckets live) : storage.objects(bucket_id,
--      name) ; storage.foldername(text) ; _is_admin() et _faction_chef(text), SECURITY DEFINER,
--      exécutables par authenticated.
-- DROP vérifié à la main le 30/09 : les six règles `true` listées ci-dessous, et les deux règles
--      de place-images qu'on élargit (« Authenticated users can upload place images » : tout
--      connecté partout ; « Users can delete their own place images » : les avatars seulement).

DROP POLICY "Allow all 1snxhtj_1" ON storage.objects;
DROP POLICY "Allow all 1snxhtj_2" ON storage.objects;
DROP POLICY "Allow all 1snxhtj_3" ON storage.objects;
DROP POLICY "Enable storage 1lvpvk4_0" ON storage.objects;
DROP POLICY "Enable storage 1lvpvk4_2" ON storage.objects;
DROP POLICY "Enable storage 1lvpvk4_3" ON storage.objects;
DROP POLICY "Authenticated users can upload place images" ON storage.objects;
DROP POLICY "Users can delete their own place images" ON storage.objects;

-- place-images : mes dossiers (places/<moi>/… et <moi>/…), ou admin.
CREATE POLICY place_images_ecrire ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'place-images' AND (
    name LIKE 'places/' || (auth.uid())::text || '/%'
    OR (storage.foldername(name))[1] = (auth.uid())::text
    OR public._is_admin()));

CREATE POLICY place_images_remplacer ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'place-images' AND (
    name LIKE 'places/' || (auth.uid())::text || '/%'
    OR (storage.foldername(name))[1] = (auth.uid())::text
    OR public._is_admin()))
  WITH CHECK (bucket_id = 'place-images' AND (
    name LIKE 'places/' || (auth.uid())::text || '/%'
    OR (storage.foldername(name))[1] = (auth.uid())::text
    OR public._is_admin()));

CREATE POLICY place_images_effacer ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'place-images' AND (
    name LIKE 'places/' || (auth.uid())::text || '/%'
    OR (storage.foldername(name))[1] = (auth.uid())::text
    OR public._is_admin()));

-- faction-emblems : l'emblème de ma Compagnie si j'en suis le chef, ou admin.
CREATE POLICY faction_emblems_ecrire ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'faction-emblems' AND (
    public._faction_chef(split_part(storage.filename(name), '.', 1)) = (auth.uid())::text
    OR public._is_admin()));

CREATE POLICY faction_emblems_remplacer ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'faction-emblems' AND (
    public._faction_chef(split_part(storage.filename(name), '.', 1)) = (auth.uid())::text
    OR public._is_admin()))
  WITH CHECK (bucket_id = 'faction-emblems' AND (
    public._faction_chef(split_part(storage.filename(name), '.', 1)) = (auth.uid())::text
    OR public._is_admin()));

-- Les seaux du Hub : les admins.
CREATE POLICY hub_ecrire ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('home-banners', 'app-ads', 'app-fragments') AND public._is_admin());

CREATE POLICY hub_remplacer ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('home-banners', 'app-ads', 'app-fragments') AND public._is_admin())
  WITH CHECK (bucket_id IN ('home-banners', 'app-ads', 'app-fragments') AND public._is_admin());

CREATE POLICY hub_effacer ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('home-banners', 'app-ads', 'app-fragments') AND public._is_admin());

-- Effacer ou remplacer un fichier demande de le voir : ces seaux publics n'avaient pas de règle de
-- lecture (le Hub liste et efface ses bannières ; le chef remplace son emblème).
CREATE POLICY seaux_publics_lire ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('home-banners', 'app-ads', 'app-fragments', 'faction-emblems'));
