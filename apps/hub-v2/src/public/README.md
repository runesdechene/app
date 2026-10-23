Pages vues par des joueurs depuis un QR ; aucune dépendance au Hub admin ; leurs adresses ne changent jamais (spec §3).

- Le routeur les sert **avant** la porte de l'équipe, chacune en `lazy` : aucune n'appelle `hub_est_admin`, aucune ne montre la coquille.
- `PagePublique` : le cadre commun, en deux dispositions — « colonne » pour les flyers (maquette Figma), « carte » pour la soumission (le design de la page en ligne).
- `briques/` : les pièces des formulaires publics.
- Un dossier par page : `flyer/` (`/flyer`), `cadeau/` (`/flyercadeau`), `soumettre/` (`/soumettre-contenu`), `desabonnement/` (`/desabonnement`, le lien du pied des Missives).
- `/flyer` et `/flyercadeau` partagent un cadre, `flyer/CadreFlyer` (route parente) : la photo et le parchemin restent, seule la page change, sans rechargement, avec la transition du navigateur. Un lien de l'une vers l'autre passe par `<Link viewTransition>`, jamais par `<a href>`, qui recharge tout.
- Rien ici n'importe `@/app` ni `@/features` : ce code ne tire rien du Hub admin.
