# test — la préparation des tests

- `setup.ts` — chargée avant chaque fichier de test (vérifications DOM lisibles, fausse carte
  MapLibre : jsdom n'a pas WebGL).
- `fausseCarte.ts` — cette fausse carte : elle retient ses écouteurs, le test les déclenche.

Les tests eux-mêmes vivent **à côté** du fichier qu'ils vérifient (`tabs.ts` → `tabs.test.ts`).
