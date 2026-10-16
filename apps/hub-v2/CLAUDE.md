# hub-v2 — le Hub V2

> Port dev 5175. En ligne sur hub.runesdechene.com (site Netlify `rdc-hub-v2`) depuis la bascule du 16/10/2026.
> Réservé aux admins (`hub_est_admin()`).

Règles communes : `CLAUDE.md` racine. Règles de construction : `.claude/rules/v2.md` et
`.claude/rules/hub.md`. DA : `packages/da`.

## Commandes

pnpm --filter hub-v2 dev | test | lint | build
pnpm --filter hub-v2 gen:types   # après chaque migration qui touche le Hub
cd apps/hub-v2 && netlify deploy --prod --dir "$PWD/dist" --functions "$PWD/netlify/functions" --no-build --site=5d04dcdd-6374-4e8b-a0f4-fcef64a707f3
