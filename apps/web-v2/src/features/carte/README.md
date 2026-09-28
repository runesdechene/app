# carte — l'onglet Carte

Conception : `docs/superpowers/specs/2026-08-18-app-v2-design.md`, §7.

Conception de l'écran : `docs/superpowers/specs/2026-09-28-v2-carte-design.md`.

- `components/` — l'affichage.
- `hooks/` — `useCarteLieux` (les lieux en cache), `useTerritoire` (le nom à inscrire).
- `api/` — `carte.ts` parle à Supabase (`carte_lieux`, `territoire_en`) ; `lireCarte.ts` lit
  leur JSON.
