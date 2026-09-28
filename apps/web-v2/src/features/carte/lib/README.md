# lib — le calcul de la carte, sans état React

- `style.ts` — le fond OpenFreeMap habillé en parchemin (fonction pure).
- `couleurs.ts` — les couleurs de la carte, lues dans les jetons `--color-carte-*`.
- `relief.ts` — la règle de la 3D : inclinée et d'assez près.
- `sceaux.ts` — les marques des lieux dessinées au canevas (bille, sceaux, étoile, pilules).
- `calques.ts` — la source des lieux (sans regroupement) et ses quatre calques ; `enGeoJSON` (pur).
- `mouvement.ts` — la durée du mouvement doux de la DA, pour que MapLibre glisse au même rythme.
- `survol.ts` — le lieu sous la souris : la main, il grossit, et au clic il « pulse ».
