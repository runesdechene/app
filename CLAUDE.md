# Runes de Chêne — Monorepo

> pnpm workspaces · TypeScript strict · Supabase · Netlify

## Où aller

| Si tu bosses sur... | Lis ce fichier |
|---------------------|----------------|
| **L'application (Conquête)** (explore-web) | `apps/explore-web/CLAUDE.md` |
| **Le Hub (Gestion de la communauté, plateforme de liaison entre boutique et Conquête)** (back-office admin) | `apps/hub/CLAUDE.md` |

## Commandes rapides

```bash
pnpm dev                # explore-web (port 3000)
pnpm --filter hub dev   # hub (port 3001)
pnpm build              # build explore-web
pnpm --filter hub build # build hub
```

## Conventions globales

- **pnpm** — jamais npm ni yarn, npx seulement pour supabas.
- **TypeScript strict** — pas de `any`
- **Conventional Commits** — `feat:`, `fix:`, `chore:`, `docs:`
- **Migrations SQL** — fichiers numérotés dans `supabase/migrations/`
- **Déploiement** — Netlify CLI manuel, jamais d'auto-deploy Git

## Ecosystem

| Projet | Lieu | Rôle |
|--------|------|------|
| **La Citadelle** | `\\EGIDE\Runes de Chêne\👑 LA CITADELLE\` | QG stratégique (Obsidian) |
| **Ce repo** | `apps/explore-web` + `apps/hub` + `supabase/` | Code applicatif |
| **Boutique Shopify** | Shopify (Runes de Chêne) | E-commerce `runesdechene.com` |

## Déploiement netlify
Pour déployer sur Netlify le Hub ou Explore-Web

1. pnpm build (depuis le dossier de l'app, hub ou explore-web)
2. netlify deploy --prod --dir "C:\Users\uriel\Desktop\DEVs\app (Runes de Chêne)\apps\explore-web\dist" --no-build
ou
2. netlify deploy --prod --dir "C:\Users\uriel\Desktop\DEVs\app (Runes de Chêne)\apps\hub\dist" --no-build