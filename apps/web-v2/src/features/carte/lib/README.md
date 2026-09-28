# lib — le calcul de la carte, sans état React

- `style.ts` — le fond OpenFreeMap habillé en parchemin (fonction pure).
- `couleurs.ts` — les couleurs de la carte, lues dans les jetons `--color-carte-*`.
- `relief.ts` — la règle de la 3D : inclinée et d'assez près.
- `sceaux.ts` — les marques des lieux dessinées au canevas (bille, sceaux, étoile, groupe).
- `calques.ts` — la source regroupée des lieux et ses cinq calques ; `enGeoJSON` (pur).
