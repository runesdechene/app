# hub — Back-office admin

> Port dev 3001. Prod : hub.runesdechene.com (Netlify).
> Accès admin uniquement (`users.role = 'admin'`).

## Mémoire projet

Conventions, gotchas, décisions, préférences, architecture :
**`~/citadelle/📱 L'application (La Carte)/🛠️ DEV/_Index DEV.md`**

4-Layer Query Rule et règles Graphify : voir `CLAUDE.md` racine monorepo.

## Spécificités cette app

- React 18 + Vite 5 + TypeScript strict
- React Router DOM
- CSS global (thème parchemin)
- **Netlify Functions** pour Shopify (sync, webhooks, proxy) dans `netlify/functions/`

## Commandes

```bash
pnpm --filter hub dev     # port 3001
pnpm --filter hub build
# Deploy — ⚠️ inclure --functions :
cd apps/hub && netlify deploy --prod --dir "$PWD/dist" --functions "$PWD/netlify/functions" --no-build
```

## Règles Hub spécifiques

- **Pattern SaveBar** — toutes les pages utilisent `<SaveBar>`. Pas d'auto-save (sauf `AssignFragments`).
- **Après chaque save** : refetch serveur pour garantir la synchro.
- **Deep copy** pour comparaison : `JSON.parse(JSON.stringify(data))`.
- **try/finally** autour des fetch — éviter les "Chargement…" infinis.
- **Classes CSS pubs** : préfixe `pub-*` (PAS `ads-*`, bloqué par ad blockers).

## Auth Hub — fetchRole

Toujours requêter par **email** (pas par id), voir Citadelle `DEV/Architecture/Auth et utilisateurs.md`.
