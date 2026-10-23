-- WHY: Poser une photo dans « Écrire » échouait (« new row violates row-level security policy », 23/10, sur
--      hub.runesdechene.com). Le Hub dépose en « créer ou remplacer » (envoyerFichier, upsert) : Supabase Storage
--      exige alors aussi le droit de lire l'objet. Les seaux du Hub qui marchent l'ont (seaux_publics_lire) ;
--      la mig 543 ne l'avait pas donné à « missives ». Lecture réservée à l'équipe, comme le dépôt : les
--      boîtes de réception, elles, lisent par l'adresse publique du seau.
-- SCHEMA CHECKED (23/10/2026, live) : pg_policies storage.objects — missives_deposer (INSERT), missives_remplacer
--   (UPDATE), missives_effacer (DELETE), aucune en SELECT ; seaux_publics_lire (SELECT, authenticated) pour
--   home-banners, app-ads, app-fragments, faction-emblems.

CREATE POLICY missives_lire ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'missives' AND public._is_admin());
