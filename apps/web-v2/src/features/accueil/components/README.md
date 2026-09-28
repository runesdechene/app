# components — l'affichage de la zone Accueil

Les composants visibles de la zone, chacun avec son `.module.css`. Ils n'appellent jamais
Supabase (ESLint le refuse) : les données arrivent par `../hooks/`, qui passe par `../api/`.

- `AccueilScreen` — la page : Nouvelles de la marque (vers la boutique), Ajoutés récemment
  (les cartes de lieu partagées, dans un carrousel).
- `SurLesChemins` — le fil de la communauté et ses saluts (feuille de chêne).
