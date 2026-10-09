# app — la coquille de la V2

Ce qui entoure les écrans, sans être un écran.

- `access/` — la garde : décide au démarrage si ce compte peut ouvrir la V2.
- `navigation/` — les onglets, la mémoire de chaque onglet, la fermeture d'un détail.
- `shell/` — la mise en page : bandeau, barre d'onglets, écrans, panneau de détail.
- `router.tsx` — la liste des adresses de l'app.
- `queryClient.ts` — le cache des données serveur.

`app/` a le droit d'importer les écrans des zones (`features/*`) ; l'inverse est interdit.
