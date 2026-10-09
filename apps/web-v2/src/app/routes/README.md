# routes — les écrans des zones, branchés sur la coquille

Une zone (`features/`) ne dépend jamais de la coquille (`app/`). Quand un écran de zone a
besoin du cadre de détail ou de la fermeture, un petit composant d'ici les lui donne, et
`router.tsx` pointe sur lui.

- `accueil.tsx` — les pages du Panthéon (`/<onglet>/classement`) et du fil « Sur les chemins »
  (`/<onglet>/chemins`).
- `compte.tsx` — le profil (`/<onglet>/explorateur/<id>`), sa modification (`…/modifier`, le
  sien seulement) et les Préférences (`/<onglet>/preferences`).
- `carte.tsx` — la feuille « Ajouter » (`/<onglet>/ajouter`) et les notifications
  (`/<onglet>/notifications`).
- `lieu.tsx` — la fiche d'un lieu (`/<onglet>/lieu/<id>`), sa fenêtre et ses feuilles.
- `vitrine.tsx` — la carte des visiteurs (`/bienvenue/carte`, positions floutées) et l'aperçu
  d'un lieu posé dessus (`/bienvenue/carte/lieu/<id>`) ; sur PC, l'onboarding (`/bienvenue/<étape>`)
  s'y pose aussi, en écran.
