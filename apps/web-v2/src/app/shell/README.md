# shell — la coquille à l'écran

- `Shell.tsx` — la grille : logotype (emblème sur desktop), lien vers la V1, « Ajouter » et la
  cloche, les quatre écrans toujours montés, le détail, la croix du tiroir.
- `TabBar.tsx` — la barre d'onglets (en bas sur mobile, dans la barre verticale de gauche sur
  desktop, comme la V1) ; l'onglet Compte porte l'avatar.
- `DetailPane.tsx` — le cadre d'un détail (plein écran sur mobile, dans le tiroir sur desktop).

**Mobile** : un écran à la fois, plein écran. **Desktop** : la carte est toujours là ; Accueil,
Messages, Compte et les détails s'ouvrent dans un tiroir entre la barre et elle ; l'onglet Carte
ou la croix le ferment (spec socle §4bis). Le JavaScript dit ce qui est ouvert
(`navigation/disposition.ts`) ; le CSS place selon la largeur, par **container query** sur le
conteneur `app` (`#root`), jamais par détection d'appareil. On n'y range pas : un écran de zone.
