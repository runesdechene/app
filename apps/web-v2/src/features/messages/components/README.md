# components — l'affichage de la zone Messages

Les composants visibles de la zone, chacun avec son `.module.css`. Ils n'appellent jamais
Supabase (ESLint le refuse) : les données arrivent par `../hooks/`, qui passe par `../api/`.

- `MessagesScreen` — les deux onglets : La communauté, Les Murmures.
- `Registre` — les canaux à cocher, les messages, la barre pour écrire.
