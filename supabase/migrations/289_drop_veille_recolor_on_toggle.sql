-- 289_drop_veille_recolor_on_toggle.sql
-- WHY : le trigger 276 (_sync_veille_color_on_faction_change) repeignait TOUS les lieux
-- veillés d'un joueur à chaque changement de bannière active → toggler sa Compagnie
-- changeait la couleur de ses territoires sur la carte. Non voulu : un territoire garde
-- la couleur de la Compagnie sous laquelle il a été pris (stampée à la plantation).
-- On retire le trigger + sa fonction. (set_user_faction legacy repeint encore mais n'est
-- plus appelé par le flow Compagnies.) ADDITIF (suppression d'un trigger ajouté en 276).
DROP TRIGGER IF EXISTS users_faction_color_sync ON public.users;
DROP FUNCTION IF EXISTS public._sync_veille_color_on_faction_change();
