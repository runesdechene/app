-- Ménage Hub (juin 2026) : deux drapeaux de mission jamais consommés.
-- notify_on_launch (notif au lancement jamais implémentée côté backend) et
-- featured_on_home (vestige du pivot home-first abandonné) : aucune RPC ni
-- l'app publique ne les lit, seul le formulaire hub les écrivait (retiré).
-- Vérifié en prod le 2026-06-29 : 0 fonction référençant ces colonnes.

ALTER TABLE public.missions DROP COLUMN IF EXISTS notify_on_launch;
ALTER TABLE public.missions DROP COLUMN IF EXISTS featured_on_home;
