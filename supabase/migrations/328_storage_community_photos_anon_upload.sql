-- 328_storage_community_photos_anon_upload.sql
-- WHY : le studio de soumission publique (apps/hub StudioSubmit.tsx, route
-- /soumettre-contenu) uploade les photos communautaires en tant que visiteur NON
-- connecté (clé anon, aucune session Supabase Auth). Un « compte » est bien créé,
-- mais c'est une ligne métier `users` (create_user_from_submission), PAS un compte
-- auth.users → le rôle du client reste `anon`.
--
-- La migration 323 (block_anon_writes) a fermé l'écriture storage anonyme en partant
-- de l'hypothèse « hub + explore-web écrivent connectés ». Vrai partout SAUF pour ce
-- flux de soumission publique. Conséquence : l'upload cassait avec
-- « new row violates row-level security policy ».
--
-- FIX : on rouvre l'INSERT anon UNIQUEMENT sur le bucket community-photos, en gardant
-- le garde-fou d'extension existant (with_check inchangé : bucket + jpg/png/webp/heic…).
-- Ce n'est PAS un retour sur 323 : le fourre-tout anon global reste fermé ; seule cette
-- exception étroite et assumée (soumission publique, lecture déjà publique via
-- « Public read community photos ») est rétablie. La modération manuelle du hub
-- (moderate_submission) reste le rempart anti-abus. ADDITIF.

BEGIN;

ALTER POLICY "Authenticated can upload community-photos"
  ON storage.objects
  TO anon, authenticated;

COMMIT;
