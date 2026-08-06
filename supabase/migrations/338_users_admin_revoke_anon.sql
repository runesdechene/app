-- 338 — `anon` n'a rien a faire sur la vue staff
--
-- WHY : la vue `users_admin` (mig 337) a herite du SELECT `anon` via les default
-- privileges du schema public. Aucune fuite aujourd'hui — son WHERE renvoie zero
-- ligne a un non-staff — mais le jour ou quelqu'un touche a ce WHERE, la vue
-- redeviendrait un robinet public. Le droit doit dire la meme chose que le WHERE.

REVOKE ALL ON public.users_admin FROM anon;
