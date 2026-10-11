# `apps/seo-pages` — Pages SEO Node.js

> Pages indexables Google pour chaque lieu de Runes de Chêne.
> En production sur `app.runesdechene.com/lieu/[slug]`.

## Essentiel

- **Stack** : Node.js / TypeScript pur (template literals, **zéro framework**)
- **Route prod** : `app.runesdechene.com/lieu/[slug]`
- **Source de données** : Supabase directe (service role key)
- **Déploiement** : Netlify (site `rdc-seo-pages`, ID `5a5b9cb9-d330-41d7-a037-6bd65ac67eb9`)
- **Cron nightly** : GitHub Actions à 3h UTC (`.github/workflows/seo-nightly.yml`)
- **Plan migration historique** : `docs/superpowers/plans/2026-04-21-seo-pages-nodejs-migration.md`

## Pipeline

```
Cron 3h UTC → generate:slugs → generate:seo (Claude Haiku) → build → deploy Netlify
```

1. **Slugs** (`scripts/generate-slugs.ts`) — slug URL-friendly, city suffix si doublon
2. **SEO descriptions** (`scripts/generate-seo.ts`) — Claude Haiku, batch de 50, rate limit handling
3. **Build** (`src/build.ts`) — toutes les pages HTML + sitemap en ~26s
4. **Deploy** — Netlify CLI `--no-build --dir=$PWD/dist` (toujours chemin absolu, voir gotcha plus bas)

### Pipeline unitaire (un seul lieu)

```bash
pnpm build:place <place-id>
# → ensureSlug → ensureSeoDescription → render → write dist/
```

Script : `scripts/process-place.ts`

## Structure

```
apps/seo-pages/
├── src/
│   ├── build.ts               ← orchestrateur batch
│   ├── lib/
│   │   ├── supabase.ts        ← client (process.env + dotenv)
│   │   ├── places.ts          ← la liste des lieux, leurs voisins (Haversine)
│   │   ├── fiche.ts           ← la fiche d'un lieu par la RPC fiche_lieu (celle de l'appli)
│   │   ├── texte.ts           ← échapper, dates, « Ain (01) », images à la taille
│   │   └── slugify.ts         ← normalisation unicode → slug
│   ├── templates/
│   │   ├── page.ts            ← assemblage, <head>, schema.org
│   │   ├── photo.ts           ← la photo, le logo, « Ouvrir Explore » / partager
│   │   ├── fiche.ts           ← la fiche (une ou deux colonnes), le bouton vers l'aperçu
│   │   ├── proximite.ts       ← les 4 lieux les plus proches
│   │   ├── pied.ts            ← le bas de page de la marque (celui de la vitrine)
│   │   ├── movement-page.ts   ← /mouvement
│   │   └── sitemap.ts
│   └── styles/global.css      ← inliné dans chaque page
├── public/lieu/_static/       ← images servies sous /lieu/_static/ (le domaine de l'appli relaie /lieu/*)
├── scripts/                   ← generate-slugs, generate-seo, process-place
└── netlify.toml
```

## Colonnes DB (migration 091)

| Colonne | Type | Usage |
|---------|------|-------|
| `places.slug` | TEXT UNIQUE | URL-friendly |
| `places.seo_description` | TEXT | Description Haiku |
| `places.seo_generated_at` | TIMESTAMPTZ | Date génération |

## Design — la V2 (11/10/2026)

Maquettes Figma 566:614 (téléphone) et 566:752 (ordinateur), validées par Uriel : la fiche de
l'appli, sans lisière sous la photo, un seul bouton « Découvrir ce lieu sur la carte » vers
`/bienvenue/carte/lieu/<id>` (l'aperçu sans compte, retenu jusqu'à l'inscription), les infos
pratiques de la V2, les lieux à proximité, le bas de page de la vitrine. Ordinateur : deux
colonnes sur la gravure du site. Les données viennent de `fiche_lieu` : une seule source.

## Gotcha déploiement

`--dir` **doit être absolu** (`$PWD/dist`), sinon Netlify résout depuis la racine repo → fichiers manquants. Vrai pour toutes les apps Netlify de ce monorepo.

## Secrets GitHub Actions

| Secret | Usage |
|--------|-------|
| `SUPABASE_URL` | URL Supabase |
| `SUPABASE_SERVICE_KEY` | Service role key |
| `ANTHROPIC_API_KEY` | Claude Haiku (génération SEO) |
| `NETLIFY_AUTH_TOKEN` | Deploy CLI |

## Env vars locales

`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY` (via `.env`).
