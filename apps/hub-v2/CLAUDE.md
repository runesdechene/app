# hub-v2 — le Hub V2

> Port dev 5175. Préparation : site Netlify `rdc-hub-v2`. Prod (après le plan 5) : hub.runesdechene.com.
> Réservé aux admins (`hub_est_admin()`).

Règles communes : `CLAUDE.md` racine. Règles de construction : `.claude/rules/v2.md` et
`.claude/rules/hub.md`. DA : `packages/da`.

## Commandes

pnpm --filter hub-v2 dev | test | lint | build
pnpm --filter hub-v2 gen:types   # après chaque migration qui touche le Hub
cd apps/hub-v2 && netlify deploy --prod --dir "$PWD/dist" --no-build   # site rdc-hub-v2 seulement
