# components — l'affichage de la zone Carte

Les composants visibles de la zone, chacun avec son `.module.css`. Ils n'appellent jamais
Supabase (ESLint le refuse) : les données arrivent par `../hooks/`, qui passe par `../api/`.

- `CarteScreen` — la carte vivante : fond, lieux, relief, inscription, rose des vents, « Ma position ».
- `Inscription` — le nom du territoire entre deux fleurons, en fondu.
- `AjouterFeuille` — la feuille du « + » de l’en-tête.
