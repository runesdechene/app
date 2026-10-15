Pages vues par des joueurs depuis un QR ; aucune dépendance au Hub admin ; leurs adresses ne changent jamais (spec §3).

- Le routeur les sert **avant** la porte de l'équipe, chacune en `lazy` : aucune n'appelle `hub_est_admin`, aucune ne montre la coquille.
- `PagePublique` : le cadre commun, en deux dispositions — « colonne » pour les flyers (maquette Figma), « carte » pour la soumission (le design de la page en ligne).
- `briques/` : les pièces des formulaires publics.
- Un dossier par page : `flyer/` (`/flyer`), `cadeau/` (`/flyercadeau`), `soumettre/` (`/soumettre-contenu`).
- Rien ici n'importe `@/app` ni `@/features` : ce code ne tire rien du Hub admin.
