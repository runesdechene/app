-- 462 — Les Fragments quittent la carte d'Explore
--
-- WHY : Uriel, 08/10/2026 : les joueurs n'aiment pas les Fragments sur la carte (retours le jour
--   même du déploiement de la 1.10.0). La carte est pour ce qui vit et bouge ; un Fragment y est de
--   la publicité. La fonction ne renvoie plus rien : la 1.10.0 en ligne les retire de la carte au
--   prochain chargement, sans attendre un déploiement ; le calque quitte ensuite le code de l'app.
--   On garde la fonction (et son contrat) pour la future carte des Fragments de la boutique.
--   Pour revenir en arrière : reprendre la définition de la mig 460.

CREATE OR REPLACE FUNCTION public.fragments_sur_la_carte()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT '[]'::jsonb;
$function$;
