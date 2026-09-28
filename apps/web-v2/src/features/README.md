# features — une zone de l'app par dossier

`accueil/`, `carte/`, `messages/` et `compte/` (les quatre onglets d'Explore), et `lieu/` (la
fiche d'un lieu, ouverte depuis n'importe quel onglet). Le Codex et le
Campement ont quitté Explore le 28/09 (§0 de la spec V2). Chaque zone a son `README.md`, qui renvoie à sa section de
la spec V2.

Une zone n'importe **jamais** une autre zone ni la coquille (ESLint le refuse) : ce qui se
partage monte dans `../shared/`.
