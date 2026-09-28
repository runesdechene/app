# accueil — l'onglet Accueil

Conception : `docs/superpowers/specs/2026-08-18-app-v2-design.md`, §5 (structure validée) ;
maquette Figma 27:2. Base : migration 368.

« L'Accueil, on le lit » : Nouvelles de la marque (la dernière annonce « produit », qui mène à la
boutique), Ajoutés récemment (les cartes de lieu partagées), Sur les chemins (qui a visité, ajouté
un lieu, rejoint les Explorateurs) et son seul geste, Saluer.

- `api/` — `accueil.ts` (les quatre appels) et `lireAccueil.ts` (la forme de leurs réponses).
- `hooks/` — `useAccueil` (les trois lectures, sous la clé `['accueil']`) et `useSaluer`
  (optimiste, revient si la base refuse).
- `lib/` — `ilYA` (« il y a 10 min »).
- `components/` — `AccueilScreen` (la page, la nouveauté, la rangée des lieux) et
  `SurLesChemins` (le fil et ses saluts).
