-- 323_storage_block_anon_writes.sql
-- WHY : faille storage découverte pendant l'audit. Six policies fourre-tout sur
-- storage.objects (héritées des defaults Supabase « Allow all … » / « Enable storage … »)
-- autorisaient INSERT/UPDATE/DELETE en `TO public USING(true)` → n'importe qui avec la
-- clé anon (publique) pouvait UPLOADER / ÉCRASER / SUPPRIMER n'importe quel fichier de
-- n'importe quel bucket via l'API Storage, sans compte.
--
-- Le hub ET explore-web écrivent dans le storage en tant qu'utilisateur CONNECTÉ
-- (clé anon + JWT → rôle `authenticated`), pas en service_role. On retire donc l'accès
-- au seul rôle non voulu — `anon` — en retargetant ces policies de `public` vers
-- `authenticated`. Toutes les écritures connectées (hub admin + app, y compris les
-- upsert) restent fonctionnelles ; l'écriture anonyme est fermée.
--
-- NB (durcissement ultérieur possible) : ces policies restent permissives pour TOUT
-- utilisateur connecté (un joueur pourrait écrire dans un bucket admin type home-banners).
-- Le least-privilege par bucket (réserver les buckets admin aux admins) est un chantier
-- séparé. Ici on ferme l'exposition NON authentifiée, qui est la faille. ADDITIF.

BEGIN;

ALTER POLICY "Allow all 1snxhtj_1"    ON storage.objects TO authenticated;  -- INSERT
ALTER POLICY "Enable storage 1lvpvk4_0" ON storage.objects TO authenticated; -- INSERT
ALTER POLICY "Allow all 1snxhtj_2"    ON storage.objects TO authenticated;  -- UPDATE
ALTER POLICY "Enable storage 1lvpvk4_2" ON storage.objects TO authenticated; -- UPDATE
ALTER POLICY "Allow all 1snxhtj_3"    ON storage.objects TO authenticated;  -- DELETE
ALTER POLICY "Enable storage 1lvpvk4_3" ON storage.objects TO authenticated; -- DELETE

COMMIT;
