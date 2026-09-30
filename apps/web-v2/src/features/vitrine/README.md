# vitrine — la porte d'entrée, sans compte

Maquettes Figma 314:146 (téléphone) et 314:203 (ordinateur), validées par Uriel le 30/09. Base :
migration 391 (fonctions ouvertes aux visiteurs) et `get_landing_stats`.

`/bienvenue` : la vitrine. On y cherche un lieu par son nom ou par sa nature, **sans compte**.
`/bienvenue/lieu/<id>` : l'aperçu d'un lieu — le début du récit, jamais la position ni les
personnes. Le reste s'ouvre en rejoignant : le lieu est retenu (`shared/lib/apresEntree`) et la fin
de l'onboarding l'ouvre sur la carte. Pas de « compte visiteur » : il remplirait la base de faux
Explorateurs.

- `api/` — `vitrine.ts` (chiffres, natures, recherche, activité, aperçu) et `lireVitrine.ts` (la
  forme des réponses).
- `hooks/` — `useVitrine` (les lectures ; la recherche attend que la frappe se pose).
- `lib/` — `activite` (« Un Explorateur vient de découvrir… », anonyme).
- `components/` — `Vitrine` (la page), `Recherche`, `DefileNatures`, `ApercuActivite`,
  `ApercuLieu`.
