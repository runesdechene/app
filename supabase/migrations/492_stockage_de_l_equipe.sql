-- WHY: audit du 11/10/2026 — tout joueur connecté pouvait déposer, remplacer ou effacer les
--      icônes des natures (tag-icons), les images de l'appli (app-assets) et les bannières des
--      Compagnies V1 (faction-patterns) : de quoi défigurer la carte de tous. Seul le Hub y écrit
--      (TagsManager, Cultures, Divers, LandingConfig, Factions) : l'équipe seulement, comme
--      home-banners, app-ads et app-fragments (hub_*). La lecture ne change pas ; le dépôt public
--      de photos communautaires (StudioSubmit) reste ouvert, voulu.
-- SCHEMA CHECKED (11/10/2026, pg_policies live, storage.objects) : les politiques nommées
--   ci-dessous ; _is_admin().

DROP POLICY "Authenticated upload tag-icons" ON storage.objects;
DROP POLICY "Authenticated update tag-icons" ON storage.objects;
DROP POLICY "Authenticated delete tag-icons" ON storage.objects;
DROP POLICY app_assets_write ON storage.objects;
DROP POLICY app_assets_delete ON storage.objects;
DROP POLICY "Auth upload faction-patterns" ON storage.objects;
DROP POLICY "Auth update faction-patterns" ON storage.objects;
DROP POLICY "Auth delete faction-patterns" ON storage.objects;

CREATE POLICY equipe_ecrire ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('tag-icons', 'app-assets', 'faction-patterns') AND public._is_admin());
CREATE POLICY equipe_remplacer ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('tag-icons', 'app-assets', 'faction-patterns') AND public._is_admin())
  WITH CHECK (bucket_id IN ('tag-icons', 'app-assets', 'faction-patterns') AND public._is_admin());
CREATE POLICY equipe_effacer ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('tag-icons', 'app-assets', 'faction-patterns') AND public._is_admin());
