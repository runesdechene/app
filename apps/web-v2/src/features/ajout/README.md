# ajout — la feuille « Ajouter » et le parcours « Ajouter un lieu »

Conception : maquette validée par Uriel le 29/09 (Figma « Ajouter un lieu — proposition ») et
`docs/superpowers/plans/2026-09-29-ajouter-un-lieu.md`. Base : migration 381.

La fiche se construit sous tes yeux : photo → où → nom, nature, époque → récit → aperçu, puis la
fête. Plein écran sur téléphone, fenêtre au centre sur PC. Le brouillon s'enregistre à chaque
geste (IndexedDB) et se reprend depuis la feuille « Ajouter ».

- `api/` — `ajout.ts` (les appels, l'envoi des photos) et `lireAjout.ts` (la forme des réponses).
- `lib/` — `brouillon` (le brouillon, ce qui manque à chaque étape), `photo` (réduire une photo,
  lire sa position), `cercleDuPin` (le cercle de 200 m d'un pin, lisible en plan comme en
  satellite) ; l'endroit en mots (`adresse`) est dans `shared/lib`, partagé avec `pin`.
- `hooks/` — `useBrouillon`, `useAjout` (natures, époques, voisins, l'endroit, poser le lieu),
  `useUrlDe` (afficher une photo du brouillon).
- `components/` — `ModifierFiche` (modifier un lieu, mig 387 : mêmes champs que l'ajout, via
  `ChampsDuLieu`), `AjouterFeuille`, `ParcoursAjout` (le cadre), `EnTete`, `BoutonSuivant`,
  `DepuisUnPin` (le brouillon né d'un pin GPS, « Remplacer ton brouillon en cours ? »), et une
  étape par fichier : `EtapePhoto`, `EtapeLieu`, `EtapeNom`, `EtapeRecit`, `EtapeApercu`.

Un brouillon peut naître d'un pin (`brouillon.pin`) : sa position prime, la base juge « sur place »
sur lui (427) ; `DepuisUnPin` le prépare.
