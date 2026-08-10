-- 339 — Le mur du Mouvement : la derniere policy moderateur qui lisait `users`
--
-- WHY : depuis le 7 aout, la page d'accueil Shopify (section `rdc_mur-vivant`)
-- n'affiche plus aucune photo. Ce n'est PAS une panne de connexion Supabase :
-- le projet repond, GoTrue est UP. `GET /rest/v1/movement_wall_photos` renvoie
-- HTTP 401 / 42501 « permission denied for table users ».
--
-- Chaine exacte, verifiee en prod le 10 aout 2026 :
--   1. la vue `movement_wall_photos` est passee en security_invoker (mig 322) :
--      la RLS des tables sous-jacentes s'applique donc avec les droits d'`anon` ;
--   2. `hub_submission_images` porte trois policies SELECT, toutes creees SANS
--      clause TO — donc PUBLIC, donc evaluees pour `anon`. Elles sont OR-ees :
--      Postgres doit toutes les evaluer, y compris « Moderators can view all
--      submission images », qui fait un EXISTS inline sur public.users et lit
--      la colonne `role` ;
--   3. la mig 336 a retire a `anon` le SELECT au niveau TABLE sur `users` au
--      profit d'une liste blanche de 5 colonnes (id, first_name, display_name,
--      avatar_url, faction_id) qui ne contient pas `role`.
--   -> la policy ne renvoie plus « faux », elle PLANTE, et toute la requete
--      tombe avec elle. Rien n'a change cote Shopify : le mur marchait depuis
--      des semaines parce que la policy etait inoffensive tant qu'`anon`
--      pouvait lire `users`.
--
-- La mig 337 (§6) a corrige exactement cette classe de bug — elle la decrit
-- meme mot pour mot — sur `hub_community_photos` et `hub_photo_submissions`,
-- en remplacant l'EXISTS inline par `_is_staff()` (SECURITY DEFINER, donc
-- evaluable par `anon` sans droit sur `users`). Elle a oublie la table jumelle
-- `hub_submission_images`, la seule que la vue du mur traverse.
--
-- QUOI : meme remede que 337 §6, sur la table oubliee. Perimetre identique
-- (admin OU moderateur) : `_is_staff()` reproduit la condition a l'identique,
-- le staff ne perd donc rien cote back-office.
--
-- RESTE OUVERT (hors perimetre, volontairement) : `member_codes` porte la meme
-- classe de policy (« Admins can manage member codes », EXISTS inline sur
-- users) et renvoie le meme 42501 a `anon`. Non corrige ici car sa condition
-- est admin SEUL : y coller `_is_staff()` elargirait l'acces aux moderateurs.
-- Aucune regression visible non plus (elle renvoyait deja zero ligne a `anon`).

BEGIN;

DROP POLICY IF EXISTS "Moderators can view all submission images"
  ON public.hub_submission_images;

CREATE POLICY "Staff can view all submission images"
  ON public.hub_submission_images FOR SELECT
  USING (public._is_staff());

COMMIT;
