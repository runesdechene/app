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
│   │   ├── places.ts          ← data layer (types, queries)
│   │   ├── slugify.ts         ← normalisation unicode → slug
│   │   └── color.ts           ← hex → HSL, thème dynamique
│   ├── templates/
│   │   ├── page.ts            ← assemblage complet (le cœur)
│   │   ├── header.ts          ← nav transparente
│   │   ├── gallery.ts         ← hero + thumbs + lightbox + JS
│   │   ├── place-content.ts   ← description + contributions
│   │   ├── contribution-card.ts
│   │   ├── nearby-places.ts   ← grille 4 lieux proches
│   │   ├── footer.ts
│   │   └── sitemap.ts
│   └── styles/
│       └── global.css         ← 760 lignes, inliné dans le HTML
├── scripts/
│   ├── generate-slugs.ts
│   ├── generate-seo.ts
│   └── process-place.ts       ← pipeline unitaire
├── public/                    ← assets statiques
├── package.json
├── netlify.toml
└── tsconfig.json
```

## Colonnes DB (migration 091)

| Colonne | Type | Usage |
|---------|------|-------|
| `places.slug` | TEXT UNIQUE | URL-friendly |
| `places.seo_description` | TEXT | Description Haiku |
| `places.seo_generated_at` | TIMESTAMPTZ | Date génération |

## Data layer (`src/lib/places.ts`)

- `getPlaceBySlug(slug)` — fetch un lieu avec tags, auteur
- `getAllPlacesWithSlugs()` — pagination 1000 rows, tags batch 300, résolution auteurs
- `getPlaceContributions(placeId)` — type `carnet`, triées par votes_up
- `getNearbyPlaces(lat, lon, excludeId)` — Haversine, 4 lieux + primary tag
- `getTotalPlaceCount()` — tous les lieux publics
- `deriveTheme(hex)` dans `color.ts` — hex → HSL → dark/deep/accent/glow

## Design

### Visuel
- **Hero** : image fullscreen (88vh), fade-in depuis parchemin, nav transparente glass, tag pill colorée, titre Bebas Neue
- **Thumbs** : bande scrollable pleine largeur, swipe tactile, lightbox clavier
- **CTA** : icône app + compteur dynamique "2600+ lieux"
- **Contenu** : fond parchemin, description SEO justifiée, contributions en carte carnet
- **Nearby** : cartes portrait 3:4 avec overlay sombre
- **Footer** : logo + texte mouvement + legal Lahoussaye EI

### SEO technique
- Schema.org : TouristAttraction + BreadcrumbList + Review
- Open Graph + Twitter Cards
- robots.txt, llms.txt, sitemap XML, canonical URLs
- Preconnect Supabase CDN, fetchpriority hero

### Palette
- Parchemin : `#f7ede1` (body), `#E8D5BE` (dark)
- Encre : `#4A3728` (text), `#7D5A3C` (light)
- Accent : `#833434`
- Fonts : Bebas Neue (titres), Cabin Condensed (accent), Cabin (body 18px)

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

## État (21 avril 2026)

- ✅ 2612 pages en prod, build 26s
- ✅ Migration Astro → Node.js terminée (8 min → 26s)
- ✅ CSS inliné + fade-in parchemin (pas de CLS)
- ✅ GitHub Actions nightly configuré
- ✅ Bouton Partager en prod (PlacePanel + SEO Page header + footer) — texte éditable depuis Hub via `app_settings.share_text_template`
- ⚠️ Sitemap pas encore soumis à Google Search Console
