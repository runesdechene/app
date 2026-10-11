# La vitrine en HTML pour Google (design)

> Validé par Uriel le 11/10/2026. Tâche 9 du plan de bascule (`plans/2026-10-07-v2-bascule.md`).

## Le problème

`app.runesdechene.com/bienvenue` renvoie une page de 3 Ko : un titre, une description et une
`<div id="root">` vide. Tout le texte de la vitrine est construit par JavaScript ; Google le lit
en différé, et mal. La page d'entrée de la marque n'a, pour lui, aucun texte.

## La solution — la vitrine rendue au build

Après `vite build`, une seconde passe :

1. `vite build --ssr src/prerendu/vitrine.tsx` construit un module qui rend `Vitrine` côté
   serveur, avec la même configuration que l'appli (mêmes classes CSS, mêmes images).
2. `scripts/prerendre-vitrine.mjs` l'appelle : il lit les chiffres (`get_landing_stats`) et les
   natures (`natures_publiques`), deux lectures publiques, rend la vitrine avec `prerender`
   (`react-dom/static`, React 19), place le HTML dans la `#root` d'une copie de
   `dist/index.html` et l'écrit en `dist/bienvenue.html`.
3. Netlify sert `bienvenue.html` à l'adresse `/bienvenue`, avant le repli sur `index.html`.
   `/bienvenue/carte`, `/bienvenue/:etape` ne changent pas.

Le navigateur monte ensuite l'appli comme aujourd'hui (`createRoot`) : elle remplace ce HTML par
le même, à l'identique. Pas d'hydratation, qui obligerait à revoir le point d'entrée de toute
l'appli pour une page.

## Ce que le HTML contient

La devise, l'accroche, « N hauts lieux… ajoutés par N explorateurs », toutes les natures (des
mots que l'on cherche), la ligne Runes de Chêne et son lien vers la boutique, les deux boutons.
Pas l'activité récente ni les résultats de recherche : vivants, sans intérêt pour un moteur.

Les chiffres sont ceux du dernier déploiement, puis la page les rafraîchit en direct.

## Ce qui ne change pas

Le service worker garde son repli sur `index.html` pour qui a l'appli installée : le HTML
prérendu sert aux moteurs et aux premières visites.

## Tests

- `src/prerendu/vitrine.test.tsx` : le HTML rendu contient l'accroche, les chiffres et les
  natures, sans activité.
- Après le build : `dist/bienvenue.html` existe, ses classes existent dans le CSS de l'appli.
- En prod : `curl /bienvenue` contient l'accroche ; l'écran ne bouge pas au chargement
  (navigateur).
