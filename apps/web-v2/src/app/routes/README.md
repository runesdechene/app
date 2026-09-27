# routes — les écrans des zones, branchés sur la coquille

Une zone (`features/`) ne dépend jamais de la coquille (`app/`). Quand un écran de zone a
besoin du cadre de détail ou de la fermeture, un petit composant d'ici les lui donne, et
`router.tsx` pointe sur lui.

- `compte.tsx` — le menu avatar (`/<onglet>/menu`), le profil (`/<onglet>/explorateur/<id>`)
  et sa modification (`…/modifier`, le sien seulement).
