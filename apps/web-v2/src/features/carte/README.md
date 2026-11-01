# carte — l'onglet Carte

Conception : `docs/superpowers/specs/2026-08-18-app-v2-design.md`, §7.

Conception de l'écran : `docs/superpowers/specs/2026-09-28-v2-carte-design.md`.

- `components/` — `CarteScreen` (la carte vivante). La feuille « Ajouter » vit dans `ajout/`.
- `lib/` — le fond de carte, le relief, les marques et les calques des lieux.
- `hooks/` — `useCarteLieux` (les lieux en cache), `usePreparerLaCarte` (code, lieux et icônes demandés en avance, depuis la coquille), `useTerritoire` (le nom à inscrire), `useTerritoiresSurLaCarte` (la forme des territoires revendiqués, migrations 569-571), `useRenommerTerritoire`,
  `useReglageCarte` (« Mes lieux en couleur », « Carte Skyrim » : clé `['preferences', <réglage>]`).
- `api/` — `carte.ts` parle à Supabase (`carte_lieux`, `territoire_en`) ; `lireCarte.ts` lit
  leur JSON.
- Énigmes (spec `2026-10-07-v2-enigmes-design.md`) : `api/enigmes.ts` + `lireEnigmes.ts`, `lib/enigmes.ts`
  (calques), `lib/cire.ts` (son), `hooks/useEnigmesSurLaCarte.ts` et `useEnigme.ts`,
  `components/SceauQuiSeRetourne.tsx` puis `FeuilleEnigme.tsx` (la feuille).
- Territoires (Figma 878:2627 → 877:2679) : `components/TerritoiresSurLaCarte.tsx` (forme, blasons
  dans des marques, cartes au toucher), `Blason`, `CarteCompagnie`, `FeuilleRenommer` ; `lib/territoires.ts`.
