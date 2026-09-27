# features — une zone de l'app par dossier

`accueil/`, `carte/`, `messages/`, `codex/`, `campement/` (les cinq onglets) et `compte/`
(le détail ouvert par l'avatar). Chaque zone a son `README.md`, qui renvoie à sa section de
la spec V2.

Une zone n'importe **jamais** une autre zone ni la coquille (ESLint le refuse) : ce qui se
partage monte dans `../shared/`.
