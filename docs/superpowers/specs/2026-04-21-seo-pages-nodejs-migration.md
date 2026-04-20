# SEO Pages — Migration Node.js + Automatisation

> Rédigé le 21 avril 2026 après la session redesign immersif.
> Ce document prépare la prochaine session de migration Astro → Node.js.

## Contexte

Les pages SEO (`carte.runesdechene.com/lieu/[slug]`) sont actuellement en **Astro 5 SSG**. Le design immersif (hero fullscreen + parchemin) est en production sur Netlify.

### Problèmes avec Astro SSG
- **Build de 8 minutes** pour 2612 pages, même pour un changement CSS
- **Adapter Netlify SSR bloqué** par un bug Windows/symlinks avec pnpm
- **Framework over-engineered** pour le besoin — on utilise ~20% des features d'Astro
- **Scalabilité** : avec des dizaines de milliers de lieux à terme, le build SSG n'est plus viable

### Pourquoi Node.js
- Uriel voulait Node.js dès le départ (XO a poussé Astro à tort)
- Pas de framework = pas de dépendance complexe, pas de bug d'adapter
- SSR natif via Netlify Functions — chaque page rendue à la demande
- Un changement CSS = redeploy instantané (pas de rebuild de pages)
- Template literals simples, maintenables, sans magie

## Ce qui existe et fonctionne (à conserver)

### Data layer (`src/lib/places.ts`)
- `getPlaceBySlug(slug)` — fetch un lieu avec tags, auteur
- `getAllPlacesWithSlugs()` — pagination 1000 rows, tags batch 300
- `getPlaceContributions(placeId)` — filtre type `carnet` uniquement
- `getNearbyPlaces(lat, lon, excludeId)` — Haversine + primary tag
- `getTotalPlaceCount()` — count total pour le CTA
- `deriveTheme(hexColor)` — hex → HSL → variables dark/accent/glow (dans `color.ts`)

### Design (CSS + structure HTML)
- Hero fullscreen immersif (88vh desktop, 100vh mobile)
- Nav transparente avec logo + CTA glass
- Breadcrumb : Runes de Chêne › Tag › Lieu
- Tag pill sur l'image
- Thumbs horizontaux scrollables
- Lightbox fullscreen avec swipe
- Contenu parchemin (#f7ede1) sous le hero
- Contributions en carte carnet (avatar gauche, texte tronqué)
- Nearby en cartes portrait avec overlay
- Gallery CTA avec icône app + compteur dynamique
- Mobile responsive complet

### SEO
- Schema.org TouristAttraction + BreadcrumbList + Review
- Open Graph + Twitter Cards
- robots.txt + llms.txt
- Preconnect Supabase CDN
- Sitemap XML
- Favicon

### Déploiement
- Site Netlify : `rdc-seo-pages` (ID: 5a5b9cb9-d330-41d7-a037-6bd65ac67eb9)
- Proxy dans explore-web : `/lieu/*` et `/_astro/*` → rdc-seo-pages
- SW explore-web exclut `/lieu/*` du navigation fallback

### Scripts pipeline
- `generate-slugs.ts` — génère les slugs manquants (pagination + city suffix)
- `generate-seo.ts` — boucle Haiku pour descriptions SEO (batch 50, rate limit handling)

## Plan de migration Node.js

### Architecture cible

```
apps/seo-pages/
  src/
    lib/
      places.ts        ← réutilisé tel quel
      color.ts          ← réutilisé tel quel
      supabase.ts       ← réutilisé tel quel
    templates/
      page.ts           ← template literal HTML (remplace tous les .astro)
      components.ts     ← header, footer, gallery, contrib, nearby en fonctions
    styles/
      global.css        ← réutilisé tel quel (servi en statique)
  functions/
    lieu.ts             ← Netlify Function SSR : /lieu/:slug → HTML
  public/
    app-icon.png
    robots.txt
    llms.txt
    global.css          ← copié au build
  scripts/
    generate-slugs.ts   ← existant
    generate-seo.ts     ← existant
    generate-sitemap.ts ← nouveau : génère sitemap.xml statique
```

### Netlify Function SSR

```ts
// functions/lieu.ts (pseudo-code)
export default async (req) => {
  const slug = extractSlug(req.url); // /lieu/abbaye-de-montmajour → abbaye-de-montmajour
  const place = await getPlaceBySlug(slug);
  if (!place) return new Response('Not Found', { status: 404 });

  const [contributions, nearby, count] = await Promise.all([...]);
  const html = renderPage(place, contributions, nearby, count);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
};
```

**Cache** : `s-maxage=3600` → Netlify CDN cache 1h. Après 1h, stale-while-revalidate sert l'ancienne version pendant qu'il regénère. Résultat : pages quasi-statiques mais toujours à jour.

### Templates en Node.js

Chaque composant Astro devient une fonction TypeScript qui retourne un string HTML :

```ts
function renderHero(place, images, primaryTag, authorName) {
  return `
    <section class="hero">
      <img src="${images[0]?.url}" alt="${escape(place.title)}" ... />
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <h1 class="hero-title">${escape(place.title)}</h1>
        ...
      </div>
    </section>
  `;
}
```

### Automatisation nightly (GitHub Actions)

```yaml
# .github/workflows/seo-nightly.yml
name: SEO Nightly
on:
  schedule:
    - cron: '0 3 * * *'  # 3h UTC
jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --filter seo-pages
      - run: pnpm --filter seo-pages generate:slugs
      - run: pnpm --filter seo-pages generate:seo
      - run: pnpm --filter seo-pages generate:sitemap
```

Ce workflow :
1. Génère les slugs pour les nouveaux lieux
2. Lance Haiku pour les descriptions manquantes
3. Regénère le sitemap statique
4. Pas besoin de rebuild — les pages SSR utilisent les données fraîches

### Étapes de migration

1. **Créer les templates Node.js** — convertir chaque .astro en fonction TS
2. **Créer la Netlify Function** — `functions/lieu.ts`
3. **Configurer le routing** — `netlify.toml` pointe `/lieu/*` vers la function
4. **Générer le sitemap** — script séparé (pas intégré au framework)
5. **Tester** — vérifier que le HTML rendu est identique
6. **Déployer** — remplacer le site Netlify existant
7. **Supprimer Astro** — plus besoin du framework

### Ce qui ne change PAS
- Le CSS (copié en statique dans `public/`)
- Le data layer (`places.ts`, `color.ts`, `supabase.ts`)
- Les scripts pipeline (`generate-slugs.ts`, `generate-seo.ts`)
- Le déploiement Netlify (même site, même proxy depuis explore-web)
- Le design (mêmes classes CSS, même structure HTML)

## Backlog restant (indépendant de la migration)

- [ ] Haiku : 2351 descriptions encore à générer (script tourne)
- [ ] Soumettre sitemap à Google Search Console
- [ ] Landing page `app.runesdechene.com` (session séparée)
- [ ] Build Netlify CI au lieu de local (résout aussi le problème SSR Astro si on reste)
