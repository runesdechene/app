# vitrine — la porte d'entrée, sans compte

Maquettes Figma 314:146 (téléphone) et 314:203 (ordinateur), validées par Uriel le 30/09 ; le bas
de page, 549:1097 et 549:828, le 11/10. Base : migration 391 (fonctions ouvertes aux visiteurs),
`get_landing_stats` et `lieux_au_hasard` (484).

`/bienvenue` : la vitrine. On y cherche un lieu par son nom ou par sa nature, **sans compte**.
`/bienvenue/carte/lieu/<id>` : l'aperçu d'un lieu, en fenêtre sur la carte des visiteurs
(positions floutées de quelques kilomètres, migration 392 ; la fenêtre vit dans `app/routes/vitrine`) — le début du récit, jamais la position ni les
personnes. Le reste s'ouvre en rejoignant : le lieu est retenu (`shared/lib/apresEntree`) et la fin
de l'onboarding l'ouvre sur la carte. Pas de « compte visiteur » : il remplirait la base de faux
Explorateurs.

Sous le premier écran, **quelques lieux de la carte** tirés au sort : leur fiche publique `/lieu/*`,
leur nature, leur département, et qui les a ajoutés — le nom et la photo de profil seulement,
exception validée par Uriel le 11/10. Puis le bas de page de la boutique (sa forêt, ses liens).

- `api/` — `vitrine.ts` (chiffres, natures, recherche, activité, aperçu, lieux au hasard) et `lireVitrine.ts` (la
  forme des réponses).
- `hooks/` — `useVitrine` (les lectures ; la recherche attend que la frappe se pose).
- `lib/` — `activite` (« Un Compagnon vient de découvrir… », anonyme).
- `components/` — `Vitrine` (la page), `Recherche`, `DefileNatures`, `ApercuActivite`,
  `ApercuLieu`, `LieuxAuHasard`, `PiedDeVitrine`.
