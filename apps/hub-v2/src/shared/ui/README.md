Les briques du Hub (spec Hub V2 §6), une par fichier : Bloc, TitreDeSection, Tuile, Balise, ChoixSegmente, LigneATraiter. Elles ne parlent jamais à Supabase.

- `EnTeteDePage` : l’en-tête des écrans (surtitre, titre, phrase, bouton à droite).

- `Tiroir` : la fiche ouverte par-dessus sa liste (panneau à droite sur PC, pleine page au téléphone) ; fermer = revenir à la liste.

- `ChampDeRecherche` : la gélule de recherche, qui attend 300 ms de calme avant d’appeler `onChange`.

- `Pages` : « 1 à 50 sur 4 750 » et précédents / suivants.

- `Bouton` : le bouton de l’appli (principal, secondaire, doux, discret), mêmes jetons. Tout bouton du Hub passe par lui.

- `Choix` : un choix dans une longue liste groupée, avec vignettes et recherche (le modèle d'une Missive) ; clavier du motif « listbox ».
