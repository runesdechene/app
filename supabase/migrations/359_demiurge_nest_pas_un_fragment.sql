-- 359 — « Demiurge (Admin) » n'est pas un Fragment
--
-- WHY : décision d'Uriel (27/09). Un Fragment est un motif qu'on achète, pas un statut. Être
-- admin est un rôle (`users.role`), que la V2 montre déjà par le badge « Admin ». Le Fragment
-- « Demiurge (Admin) » (id 3) faisait double emploi : on le retire.
-- Vérifié à la main le 27/09 : 4 possesseurs (les 4 admins), 1 mot (« Demiurge », id 8) porté
-- comme titre par 3 comptes en V1, aucune énigme, aucune affinité, aucun usage de pouvoir, aucun
-- signe ; aucun code (V1, Hub, V2) ne le lit. Les suppressions en cascade emportent son mot et
-- ses 4 possessions. L'image `app-fragments/fragment-3.webp` reste au stockage (registre de
-- purge). Si « Démiurge » doit revenir, ce sera comme titre offert.

-- 1. Le mot n'est plus porté comme titre (sinon la V1 garderait une référence morte).
UPDATE public.users
   SET displayed_title_ids_v3 = array_remove(displayed_title_ids_v3, -8)
 WHERE -8 = ANY(displayed_title_ids_v3);

-- 2. Le Fragment disparaît (cascade : fragment_words, user_fragments, affinités, usages).
DELETE FROM public.title_fragments
 WHERE id = 3 AND name = 'Demiurge (Admin)';
