# components — l'affichage de la zone Carte

Les composants visibles de la zone, chacun avec son `.module.css`. Ils n'appellent jamais
Supabase (ESLint le refuse) : les données arrivent par `../hooks/`, qui passe par `../api/`.

- `CarteScreen` — la carte vivante : fond, lieux, relief, inscription, rose des vents, « Ma position ».
- `Inscription` — le nom du territoire entre deux fleurons, en fondu.
- `Recherche` — « Un lieu, une ville… » parmi les lieux chargés, sans accents ni casse.
- `FiltreFeuille` — la feuille du bouton Filtre : « Seulement mes lieux ».
- `CompteurActifs` — « 7 actifs », à côté de la jauge d'énergie.
- `FeuilleActifs` — « Les actifs autour de toi », les plus proches d'abord.
- `CarteExplorateur` — la carte d'un Explorateur touché, centrée comme le profil.
