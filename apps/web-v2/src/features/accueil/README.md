# accueil — l'onglet Accueil

Conception : `docs/superpowers/specs/2026-08-18-app-v2-design.md`, §5 (structure validée) ;
maquettes Figma 27:2 et 275:128. Base : migrations 368, 374 à 376 ; la bannière lit les
bannières du Hub (`get_random_home_banner`).

« L'Accueil, on le lit » : une bannière de la boutique tirée au hasard, Ajoutés récemment (les
cartes de lieu partagées), Près de toi (les lieux proches pas encore visités en GPS), Sur les
chemins (qui a visité, ajouté un lieu, rejoint les Explorateurs) et son seul geste, Saluer — un
cœur, à volonté.

- `api/` — `accueil.ts` (les appels) et `lireAccueil.ts` (la forme de leurs réponses).
- `hooks/` — `useAccueil` (les lectures, sous la clé `['accueil']`) et `useSaluer` (un cœur de
  plus à chaque toucher ; le fil se relit à la fin de la rafale).
- `components/` — `AccueilScreen` (la page et la rangée des Ajoutés), `Banniere`, `PresDeToi` et
  `SurLesChemins` (le fil et ses saluts).
