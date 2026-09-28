# routes — les écrans des zones, branchés sur la coquille

Une zone (`features/`) ne dépend jamais de la coquille (`app/`). Quand un écran de zone a
besoin du cadre de détail ou de la fermeture, un petit composant d'ici les lui donne, et
`router.tsx` pointe sur lui.

- `accueil.tsx` — la page du classement des Grands Explorateurs (`/<onglet>/classement`).
- `compte.tsx` — le profil (`/<onglet>/explorateur/<id>`), sa modification (`…/modifier`, le
  sien seulement) et les Préférences (`/<onglet>/preferences`).
- `carte.tsx` — la feuille « Ajouter » (`/<onglet>/ajouter`) et les notifications
  (`/<onglet>/notifications`).
- `lieu.tsx` — la fiche d'un lieu (`/<onglet>/lieu/<id>`), sa fenêtre et ses feuilles.
