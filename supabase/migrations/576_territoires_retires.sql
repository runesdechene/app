-- WHY: les territoires sont abandonnés (Uriel, 01/11/2026) : « la carte ne fonctionne pas pour du
-- territoire ». Avec les plantations sur place de la V1, 254 formes rendaient les centres-villes
-- illisibles, quel que soit le dessin (liseré, blason, nom seul). Le front qui les lisait n'a jamais été
-- déployé et vient d'être retiré.
-- Vérifié à la main le 01/11 avant le DROP : aucun appel hors des migrations 569-575, ni dans apps/ et
-- packages/, ni dans une autre fonction de la base (pg_get_functiondef) ; noms_de_territoire est vide.
DROP FUNCTION public.renommer_territoire(text, text);
DROP FUNCTION public.territoires_revendiques();
DROP FUNCTION public._tient_le_territoire(text, text[], text);
DROP FUNCTION public._territoires();
DROP TABLE public.noms_de_territoire;
