# components — l'affichage de la zone Accueil

Les composants visibles de la zone, chacun avec son `.module.css`. Ils n'appellent jamais
Supabase (ESLint le refuse) : les données arrivent par `../hooks/`, qui passe par `../api/`.
