-- WHY: Le Hub V2 envoie ses images en `upsert` (shared/lib/envoi.ts) : Storage fait alors un INSERT … ON
--      CONFLICT DO UPDATE, qui demande aussi les droits de lecture et de mise à jour. Le seau
--      « announcement-covers » n'avait que déposer et effacer (mig 222, pour l'ancien Hub) : depuis la
--      bascule, toute image de mise à jour était refusée (« new row violates row-level security policy »,
--      25/10). Même modèle que « missives » (mig 543) : seule l'équipe.
-- SCHEMA CHECKED (25/10/2026, live) : pg_policies sur storage.objects — announcement_covers_insert (INSERT)
--   et announcement_covers_delete (DELETE), aucune SELECT ni UPDATE ; _is_admin() existe.

CREATE POLICY announcement_covers_remplacer ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'announcement-covers' AND public._is_admin())
  WITH CHECK (bucket_id = 'announcement-covers' AND public._is_admin());

CREATE POLICY announcement_covers_lire ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'announcement-covers' AND public._is_admin());
