# carte — l'onglet Carte

Conception : `docs/superpowers/specs/2026-08-18-app-v2-design.md`, §7.

Conception de l'écran : `docs/superpowers/specs/2026-09-28-v2-carte-design.md`.

- `components/` — `CarteScreen` (la carte vivante). La feuille « Ajouter » vit dans `ajout/`.
- `lib/` — le fond de carte, le relief, les marques et les calques des lieux.
- `hooks/` — `useCarteLieux` (les lieux en cache), `useTerritoire` (le nom à inscrire),
  `useLieuxEnCouleur` (l'option des Préférences, clé `['preferences', 'lieuxEnCouleur']`).
- `api/` — `carte.ts` parle à Supabase (`carte_lieux`, `territoire_en`) ; `lireCarte.ts` lit
  leur JSON.
