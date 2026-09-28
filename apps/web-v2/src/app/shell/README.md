# shell — la coquille à l'écran

- `Shell.tsx` — la grille : logotype, lien vers la V1, « Ajouter » et la cloche, les quatre écrans
  toujours montés, le détail.
- `TabBar.tsx` — la barre d'onglets (en bas sur mobile, dans le bandeau sur desktop) ; l'onglet
  Compte porte l'avatar.
- `DetailPane.tsx` — le cadre d'un détail (plein écran sur mobile, panneau sur desktop).

Mobile ou desktop se décide par **container query** sur le conteneur `app` (`#root`), jamais
par détection d'appareil. On n'y range pas : un écran de zone.
