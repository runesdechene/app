# hub-v2 — le Hub, au design de la V2

La zone de pilotage de Runes de Chêne et de sa communauté (spec
`docs/superpowers/specs/2026-10-14-hub-v2-design.md`). Remplacera `apps/hub` à la bascule.

- `src/app/` — la coquille : entrée par code, porte admin, menu, routes.
- `src/features/<domaine>/` — un dossier par domaine du menu (`api/`, `components/`, `hooks/`, `lib/`).
- `src/shared/` — client Supabase, briques (`ui/`), fonctions pures (`lib/`).

Commandes : `pnpm --filter hub-v2 dev` (port 5175) · `test` · `lint` · `build`.
