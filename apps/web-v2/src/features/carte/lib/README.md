# lib — le calcul de la carte, sans état React

- `relief.ts` — la règle de la 3D : inclinée et d'assez près.
- `sceaux.ts` — les marques des lieux dessinées au canevas (bille, sceaux, étoile, pilules).
- `calques.ts` — la source des lieux (sans regroupement) et ses quatre calques ; `enGeoJSON` (pur).
- `mouvement.ts` — la durée du mouvement doux de la DA, pour que MapLibre glisse au même rythme.
- `survol.ts` — le lieu sous la souris : la main, il grossit, et au clic il « pulse ».

Le style parchemin et ses couleurs sont montés dans `shared/lib/` (styleCarte, couleursCarte) :
l'étape « Où » de l'ajout d'un lieu dessine la même carte.
