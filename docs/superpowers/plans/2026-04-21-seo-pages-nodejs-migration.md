# SEO Pages — Migration Astro → Node.js

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le build Astro SSG (8 min pour 2612 pages) par un générateur Node.js/TS pur qui produit le même HTML statique, avec support batch (nightly) et incrémental (un seul lieu à la demande).

**Architecture:** Un module `render(place) → string` qui génère le HTML complet d'une page. Appelé en boucle pour le batch, ou unitairement via un pipeline `slug → seo → render → deploy`. Le CSS et les assets statiques sont copiés tels quels. Sitemap généré manuellement. Zéro framework de templating — template literals TS purs.

**Tech Stack:** Node.js + TypeScript (tsx), Supabase JS, Anthropic SDK (Haiku), template literals, fs/path natifs.

---

## File Structure

```
apps/seo-pages/
├── src/
│   ├── lib/
│   │   ├── supabase.ts          ← MODIFIER: remplacer import.meta.env par process.env
│   │   ├── places.ts            ← GARDER TEL QUEL (déjà TS pur)
│   │   ├── slugify.ts           ← GARDER TEL QUEL
│   │   └── color.ts             ← GARDER TEL QUEL
│   ├── templates/
│   │   ├── page.ts              ← CRÉER: layout HTML complet (ex Base.astro + [slug].astro)
│   │   ├── header.ts            ← CRÉER: render header
│   │   ├── gallery.ts           ← CRÉER: render hero + thumbs + lightbox + script
│   │   ├── place-content.ts     ← CRÉER: render description + contributions
│   │   ├── contribution-card.ts ← CRÉER: render une contribution
│   │   ├── nearby-places.ts     ← CRÉER: render grille lieux proches
│   │   ├── footer.ts            ← CRÉER: render footer
│   │   └── sitemap.ts           ← CRÉER: render sitemap XML
│   └── build.ts                 ← CRÉER: orchestrateur batch (remplace astro build)
├── scripts/
│   ├── generate-slugs.ts        ← GARDER TEL QUEL
│   ├── generate-seo.ts          ← GARDER TEL QUEL
│   └── process-place.ts         ← CRÉER: pipeline unitaire (slug → seo → render → write)
├── public/                      ← GARDER TEL QUEL (copié dans dist/)
├── package.json                 ← MODIFIER: retirer astro, ajouter script build
├── netlify.toml                 ← MODIFIER: adapter commande build
└── tsconfig.json                ← MODIFIER: retirer refs astro
```

**Principe clé:** chaque fichier `src/templates/*.ts` exporte une seule fonction qui retourne un `string` HTML. Pas de classe, pas d'abstraction — une fonction, un string.

---

## Task 1: Nettoyer les dépendances et la config

**Files:**
- Modify: `apps/seo-pages/package.json`
- Modify: `apps/seo-pages/tsconfig.json`
- Modify: `apps/seo-pages/netlify.toml`

- [ ] **Step 1: Mettre à jour package.json**

Retirer `astro` et `@astrojs/sitemap`. Ajouter les scripts. Garder supabase, anthropic, tsx, dotenv, typescript.

```json
{
  "name": "@runes/seo-pages",
  "type": "module",
  "version": "2.0.0",
  "private": true,
  "scripts": {
    "build": "tsx src/build.ts",
    "build:place": "tsx scripts/process-place.ts",
    "generate:slugs": "tsx scripts/generate-slugs.ts",
    "generate:seo": "tsx scripts/generate-seo.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@supabase/supabase-js": "^2.39.3"
  },
  "devDependencies": {
    "dotenv": "^16.4.0",
    "tsx": "^4.19.0",
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Step 2: Mettre à jour tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist-ts",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@lib/*": ["./src/lib/*"],
      "@templates/*": ["./src/templates/*"]
    }
  },
  "include": ["src/**/*.ts", "scripts/**/*.ts"]
}
```

- [ ] **Step 3: Mettre à jour netlify.toml**

```toml
[build]
  command = "pnpm run build"
  publish = "dist"

[[headers]]
  for = "/*"
  [headers.values]
    X-Robots-Tag = "index, follow"
    Cache-Control = "public, max-age=3600, s-maxage=86400"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

- [ ] **Step 4: Commit**

```bash
git add apps/seo-pages/package.json apps/seo-pages/tsconfig.json apps/seo-pages/netlify.toml
git commit -m "chore(seo-pages): strip astro deps, prep for node.js migration"
```

---

## Task 2: Adapter le client Supabase

**Files:**
- Modify: `apps/seo-pages/src/lib/supabase.ts`

- [ ] **Step 1: Remplacer import.meta.env par process.env**

```typescript
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

- [ ] **Step 2: Vérifier que places.ts compile**

Run: `cd apps/seo-pages && npx tsx --eval "import { getTotalPlaceCount } from './src/lib/places'; getTotalPlaceCount().then(c => console.log(c + ' places'))"`

Expected: `2612 places` (ou un nombre similaire)

- [ ] **Step 3: Commit**

```bash
git add apps/seo-pages/src/lib/supabase.ts
git commit -m "fix(seo-pages): switch supabase client to process.env"
```

---

## Task 3: Template — Header

**Files:**
- Create: `apps/seo-pages/src/templates/header.ts`

- [ ] **Step 1: Créer le template**

```typescript
export function renderHeader(): string {
  return `<nav class="nav">
  <a href="https://runesdechene.com" class="nav-logo">
    <img
      src="https://runesdechene.com/cdn/shop/files/LOGO_ligne_marron.webp"
      alt="Runes de Chêne"
      loading="eager"
    />
  </a>
  <a href="https://carte.runesdechene.com" class="nav-cta">Ouvrir l'application</a>
</nav>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/seo-pages/src/templates/header.ts
git commit -m "feat(seo-pages): add header template"
```

---

## Task 4: Template — Footer

**Files:**
- Create: `apps/seo-pages/src/templates/footer.ts`

- [ ] **Step 1: Créer le template**

```typescript
export function renderFooter(): string {
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="footer-logo">
    <img
      src="https://runesdechene.com/cdn/shop/files/LOGO_ligne_marron.webp"
      alt="Runes de Chêne"
      loading="lazy"
    />
  </div>
  <p class="footer-text">
    Un mouvement né de l'amour pour l'Histoire, le patrimoine et la Nature.
    Des milliers d'explorateurs qui refusent l'oubli et documentent les lieux remarquables de France et d'ailleurs.
    Rejoignez-nous.
  </p>
  <nav class="footer-links">
    <a href="https://runesdechene.com">La Boutique</a>
    <a href="https://carte.runesdechene.com">Télécharger l'app</a>
    <a href="https://www.instagram.com/runesdechene" target="_blank" rel="noopener">Instagram</a>
  </nav>
  <p class="footer-copy">&copy; ${year} Runes de Chêne — Tous droits réservés. Marque et application développées par Lahoussaye EI.</p>
</footer>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/seo-pages/src/templates/footer.ts
git commit -m "feat(seo-pages): add footer template"
```

---

## Task 5: Template — ContributionCard

**Files:**
- Create: `apps/seo-pages/src/templates/contribution-card.ts`

- [ ] **Step 1: Créer le template**

```typescript
import type { Contribution } from '../lib/places';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function renderContributionCard(c: Contribution): string {
  const initial = c.user_name.charAt(0).toUpperCase();
  const dateStr = formatDate(c.created_at);
  const content = c.content ?? '';
  const truncateLength = 180;
  const isLong = content.length > truncateLength;
  const preview = isLong ? content.slice(0, truncateLength).trimEnd() + '\u2026' : content;

  const avatarInner = c.user_avatar
    ? `<img src="${escapeHtml(c.user_avatar)}" alt="${escapeHtml(c.user_name)}" loading="lazy" />`
    : escapeHtml(initial);

  const votesHtml = c.votes_up > 0
    ? `<div class="contribution-votes">+${c.votes_up}</div>`
    : '';

  const titleHtml = c.title
    ? `<p class="contribution-title">${escapeHtml(c.title)}</p>`
    : '';

  const readMoreHtml = isLong
    ? `<p class="contribution-text contribution-full">&laquo; ${escapeHtml(content)} &raquo;</p>
<button class="contribution-read-more" onclick="const card=this.closest('.contribution-card'); card.querySelector('.contribution-preview').style.display='none'; card.querySelector('.contribution-full').style.display='block'; this.style.display='none';">Lire la suite</button>`
    : '';

  return `<div class="contribution-card">
  <div class="contribution-layout">
    <div class="contribution-avatar-col">
      <div class="contribution-avatar">${avatarInner}</div>
    </div>
    <div class="contribution-body">
      <div class="contribution-header">
        <div>
          <div class="contribution-name">${escapeHtml(c.user_name)}</div>
          <div class="contribution-date">${dateStr}</div>
        </div>
        ${votesHtml}
      </div>
      ${titleHtml}
      <p class="contribution-text contribution-preview">&laquo; ${escapeHtml(preview)} &raquo;</p>
      ${readMoreHtml}
    </div>
  </div>
</div>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/seo-pages/src/templates/contribution-card.ts
git commit -m "feat(seo-pages): add contribution card template"
```

---

## Task 6: Template — Gallery (hero + thumbs + lightbox + script)

**Files:**
- Create: `apps/seo-pages/src/templates/gallery.ts`

- [ ] **Step 1: Créer le template**

```typescript
import type { PlaceTag } from '../lib/places';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface GalleryProps {
  images: Array<{ id: string; url: string; thumb?: string }>;
  title: string;
  address: string;
  authorName: string;
  primaryTag: PlaceTag | null;
  placeCount: number;
  breadcrumbTag: string;
}

export function renderGallery(props: GalleryProps): string {
  const { images: rawImages, title, address, authorName, primaryTag, placeCount, breadcrumbTag } = props;
  const images = rawImages ?? [];
  const mainImage = images[0] ?? null;

  const heroImg = mainImage
    ? `<img src="${escapeHtml(mainImage.url)}" alt="${escapeHtml(title)}" loading="eager" fetchpriority="high" class="hero-img" data-gallery-main />`
    : `<div class="hero-placeholder"><span>Aucune photo</span></div>`;

  const fullscreenBtn = mainImage
    ? `<button class="hero-fullscreen" data-gallery-fullscreen aria-label="Voir en plein écran">\u26F6</button>`
    : '';

  const tagHtml = primaryTag ? (() => {
    const iconHtml = primaryTag.icon
      ? `<span class="hero-tag-icon" style="background-color: ${escapeHtml(primaryTag.color)}; -webkit-mask-image: url(${escapeHtml(primaryTag.icon)}); mask-image: url(${escapeHtml(primaryTag.icon)});"></span>`
      : '';
    return `<div class="hero-tag" style="background: ${escapeHtml(primaryTag.background)}; color: ${escapeHtml(primaryTag.color)};">${iconHtml}${escapeHtml(primaryTag.title)}</div>`;
  })() : '';

  const addressHtml = address ? `<p class="hero-address">${escapeHtml(address)}</p>` : '';
  const creditHtml = authorName ? `<p class="hero-credit">Photo par ${escapeHtml(authorName)}</p>` : '';

  const breadcrumbTagEncoded = encodeURIComponent(breadcrumbTag.toLowerCase());

  const thumbsHtml = images.length > 1
    ? `<div class="thumbs" data-gallery-thumbs>
${images.map((img, i) => `  <div class="thumb${i === 0 ? ' active' : ''}" data-gallery-thumb="${i}">
    <img src="${escapeHtml(img.thumb || img.url)}" alt="${escapeHtml(title)} — photo ${i + 1}" loading="lazy" />
  </div>`).join('\n')}
</div>`
    : '';

  const urls = JSON.stringify(images.map(img => img.url));

  return `<!-- HERO -->
<section class="hero" data-gallery>
  ${heroImg}
  <div class="hero-overlay"></div>
  ${fullscreenBtn}
  <div class="hero-content">
    <div class="hero-breadcrumb">
      <a href="https://runesdechene.com">Runes de Ch\u00EAne</a>
      <span class="sep">\u203A</span>
      <a href="https://carte.runesdechene.com/lieu?tag=${breadcrumbTagEncoded}">${escapeHtml(breadcrumbTag)}</a>
      <span class="sep">\u203A</span>
      ${escapeHtml(title)}
    </div>
    ${tagHtml}
    <h1 class="hero-title">${escapeHtml(title)}</h1>
    ${addressHtml}
    ${creditHtml}
  </div>
</section>

${thumbsHtml}

<!-- GALLERY CTA -->
<a href="https://carte.runesdechene.com" class="gallery-cta">
  <img src="/app-icon.png" alt="Runes de Ch\u00EAne" class="gallery-cta-logo" loading="lazy" />
  <span>
    D\u00E9couvrir ce lieu sur l'application
    <span class="gallery-cta-sub">\u00C9co-tourisme d'aventure \u00B7 ${placeCount}+ lieux \u00E0 explorer \u00B7 Gratuit</span>
  </span>
</a>

<!-- LIGHTBOX -->
<div class="lightbox" data-lightbox>
  <button class="lightbox-close" data-lightbox-close>\u2715</button>
  <button class="lightbox-nav lightbox-prev" data-lightbox-prev>\u2039</button>
  <img src="" alt="" data-lightbox-img />
  <button class="lightbox-nav lightbox-next" data-lightbox-next>\u203A</button>
</div>

<!-- INTERACTION SCRIPT -->
<script>
(function() {
  var urls = ${urls};
  var gallery = document.querySelector('[data-gallery]');
  var thumbsContainer = document.querySelector('[data-gallery-thumbs]');
  var lightbox = document.querySelector('[data-lightbox]');
  var currentIndex = 0;

  function goTo(index) {
    if (index < 0) index = urls.length - 1;
    if (index >= urls.length) index = 0;
    currentIndex = index;
    var mainImg = gallery && gallery.querySelector('[data-gallery-main]');
    if (mainImg) mainImg.src = urls[index];
    if (thumbsContainer) {
      thumbsContainer.querySelectorAll('[data-gallery-thumb]').forEach(function(t, i) {
        t.classList.toggle('active', i === index);
        if (i === index) t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });
    }
    var lbImg = lightbox && lightbox.querySelector('[data-lightbox-img]');
    if (lbImg) lbImg.src = urls[index];
  }

  if (thumbsContainer) {
    thumbsContainer.querySelectorAll('[data-gallery-thumb]').forEach(function(thumb, i) {
      thumb.addEventListener('click', function() { goTo(i); });
    });
  }

  if (gallery && urls.length > 1) {
    var startX = 0, startY = 0;
    gallery.addEventListener('touchstart', function(e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    gallery.addEventListener('touchend', function(e) {
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goTo(currentIndex + 1);
        else goTo(currentIndex - 1);
      }
    }, { passive: true });
  }

  var fsBtn = document.querySelector('[data-gallery-fullscreen]');
  var lbImg = lightbox && lightbox.querySelector('[data-lightbox-img]');
  var lbClose = lightbox && lightbox.querySelector('[data-lightbox-close]');

  function openLightbox() {
    if (!lightbox || !lbImg) return;
    lbImg.src = urls[currentIndex];
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    if (lightbox) lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (fsBtn) fsBtn.addEventListener('click', openLightbox);
  var mainImg = gallery && gallery.querySelector('[data-gallery-main]');
  if (mainImg) mainImg.addEventListener('dblclick', openLightbox);
  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lightbox) lightbox.addEventListener('click', function(e) { if (e.target === lightbox) closeLightbox(); });

  var lbPrev = lightbox && lightbox.querySelector('[data-lightbox-prev]');
  var lbNext = lightbox && lightbox.querySelector('[data-lightbox-next]');
  if (lbPrev) lbPrev.addEventListener('click', function(e) { e.stopPropagation(); goTo(currentIndex - 1); });
  if (lbNext) lbNext.addEventListener('click', function(e) { e.stopPropagation(); goTo(currentIndex + 1); });

  document.addEventListener('keydown', function(e) {
    if (!lightbox || !lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
    if (e.key === 'ArrowRight') goTo(currentIndex + 1);
  });
})();
</script>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/seo-pages/src/templates/gallery.ts
git commit -m "feat(seo-pages): add gallery template with lightbox"
```

---

## Task 7: Template — PlaceContent (description + contributions)

**Files:**
- Create: `apps/seo-pages/src/templates/place-content.ts`

- [ ] **Step 1: Créer le template**

```typescript
import type { Contribution } from '../lib/places';
import { renderContributionCard } from './contribution-card';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface PlaceContentProps {
  description: string | null;
  accessibility: string | null;
  contributions: Contribution[];
}

export function renderPlaceContent(props: PlaceContentProps): string {
  const { description, accessibility, contributions } = props;
  const featured = contributions[0] ?? null;
  const remaining = contributions.slice(1);

  const descHtml = description
    ? `<div class="description">${description.replace(/\n\n/g, '</p><p>').replace(/^/, '<p>').replace(/$/, '</p>')}</div>`
    : '';

  const accessHtml = accessibility
    ? `<div class="place-accessibility"><strong>Accessibilité</strong>${escapeHtml(accessibility)}</div>`
    : '';

  let contribHtml = '';
  if (featured) {
    const remainingHtml = remaining.length > 0
      ? `<button class="contributions-toggle" onclick="this.nextElementSibling.classList.toggle('open'); this.style.display='none';">Voir les ${remaining.length} autre${remaining.length > 1 ? 's' : ''} récit${remaining.length > 1 ? 's' : ''}</button>
<div class="contributions-hidden">
${remaining.map(c => renderContributionCard(c)).join('\n')}
</div>`
      : '';

    contribHtml = `<div style="margin-bottom: 32px;">
  <div class="section-label">Récit d'explorateur</div>
  ${renderContributionCard(featured)}
  ${remainingHtml}
</div>`;
  }

  return `<div>
  ${descHtml}
  ${accessHtml}
  ${contribHtml}
  <a href="https://carte.runesdechene.com" class="contribute-btn">Ajouter ma contribution</a>
</div>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/seo-pages/src/templates/place-content.ts
git commit -m "feat(seo-pages): add place content template"
```

---

## Task 8: Template — NearbyPlaces

**Files:**
- Create: `apps/seo-pages/src/templates/nearby-places.ts`

- [ ] **Step 1: Créer le template**

```typescript
import type { NearbyPlace } from '../lib/places';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderNearbyPlaces(places: NearbyPlace[]): string {
  if (places.length === 0) return '';

  const cards = places.map(place => {
    const img = (place.images ?? [])[0];
    const imgHtml = img?.url
      ? `<img src="${escapeHtml(img.thumb || img.url)}" alt="${escapeHtml(place.title)}" loading="lazy" class="nearby-card-img" />`
      : `<div class="nearby-card-img nearby-card-placeholder"></div>`;

    let tagHtml = '';
    if (place.primaryTag) {
      const iconHtml = place.primaryTag.icon
        ? `<span class="nearby-card-tag-icon" style="background-color: rgba(255,255,255,0.9); -webkit-mask-image: url(${escapeHtml(place.primaryTag.icon)}); mask-image: url(${escapeHtml(place.primaryTag.icon)});"></span>`
        : '';
      tagHtml = `<span class="nearby-card-tag">${iconHtml}${escapeHtml(place.primaryTag.title)}</span>`;
    }

    return `<a href="/lieu/${escapeHtml(place.slug)}" class="nearby-card">
  <div class="nearby-card-visual">
    ${imgHtml}
    <div class="nearby-card-overlay">
      ${tagHtml}
      <span class="nearby-card-name">${escapeHtml(place.title)}</span>
    </div>
  </div>
</a>`;
  }).join('\n');

  return `<section class="nearby-section">
  <div class="section-label">Lieux à proximité</div>
  <div class="nearby-grid">
    ${cards}
  </div>
</section>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/seo-pages/src/templates/nearby-places.ts
git commit -m "feat(seo-pages): add nearby places template"
```

---

## Task 9: Template — Sitemap

**Files:**
- Create: `apps/seo-pages/src/templates/sitemap.ts`

- [ ] **Step 1: Créer le template**

```typescript
export function renderSitemap(slugs: string[]): string {
  const urls = slugs.map(slug =>
    `  <url>
    <loc>https://carte.runesdechene.com/lieu/${slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/seo-pages/src/templates/sitemap.ts
git commit -m "feat(seo-pages): add sitemap template"
```

---

## Task 10: Template — Page complète (layout + assemblage)

**Files:**
- Create: `apps/seo-pages/src/templates/page.ts`

Ce fichier assemble tout. C'est le coeur du générateur — il remplace `Base.astro` + `[slug].astro`.

- [ ] **Step 1: Créer le template**

```typescript
import type { Place, Contribution, NearbyPlace } from '../lib/places';
import { deriveTheme } from '../lib/color';
import { renderHeader } from './header';
import { renderGallery } from './gallery';
import { renderPlaceContent } from './place-content';
import { renderNearbyPlaces } from './nearby-places';
import { renderFooter } from './footer';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface RenderPageInput {
  place: Place;
  contributions: Contribution[];
  nearby: NearbyPlace[];
  placeCount: number;
}

export function renderPage(input: RenderPageInput): string {
  const { place, contributions, nearby, placeCount } = input;

  const firstImageUrl = place.images?.[0]?.url ?? null;
  const metaDescription = (place.seo_description || place.text || '').slice(0, 155);
  const canonicalUrl = `https://carte.runesdechene.com/lieu/${place.slug}`;
  const tagLabel = place.primaryTag?.title ?? 'Lieu';
  const title = `${place.title} — Runes de Chêne`;
  const ogImage = firstImageUrl || '/og-default.png';

  const color = place.primaryTag?.color || '#C19A6B';
  const bg = place.primaryTag?.background || '#F5E6D3';
  const theme = deriveTheme(color);

  const reviews = contributions
    .filter(c => c.content && c.content.length > 20)
    .map(c => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: c.user_name },
      datePublished: c.created_at.slice(0, 10),
      reviewBody: c.content.slice(0, 300),
    }));

  const schemaOrg = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: place.title,
    description: metaDescription,
    address: place.address || undefined,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: place.latitude,
      longitude: place.longitude,
    },
    image: place.images?.map(img => img.url).filter(Boolean) || undefined,
    url: canonicalUrl,
    isAccessibleForFree: true,
    touristType: 'Nature & Heritage',
    ...(reviews.length > 0 && { review: reviews }),
    ...(place.author_name && { creator: { '@type': 'Person', name: place.author_name } }),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Runes de Chêne', item: 'https://carte.runesdechene.com' },
      { '@type': 'ListItem', position: 2, name: tagLabel, item: `https://carte.runesdechene.com/lieu?tag=${encodeURIComponent(tagLabel.toLowerCase())}` },
      { '@type': 'ListItem', position: 3, name: place.title },
    ],
  };

  const sectionLabel = place.seo_description
    ? `<div class="section-label">À propos de ${escapeHtml(place.title)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#f7ede1" />
  <meta name="author" content="Runes de Chêne" />
  <link rel="preconnect" href="https://ukpapqssgsxirsgmcvof.supabase.co" />
  <link rel="dns-prefetch" href="https://ukpapqssgsxirsgmcvof.supabase.co" />
  <link rel="icon" type="image/png" href="/app-icon.png" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(metaDescription)}" />
  <link rel="canonical" href="${canonicalUrl}" />

  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(metaDescription)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="fr_FR" />
  <meta property="og:site_name" content="Runes de Chêne" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(metaDescription)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />

  <script type="application/ld+json">${JSON.stringify(schemaOrg)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>

  <link rel="stylesheet" href="/assets/global.css" />
  <style>
    :root {
      --tag-color: ${color};
      --tag-bg: ${bg};
      --tag-dark: ${theme.tagDark};
      --tag-deep: ${theme.tagDeep};
      --tag-accent: ${theme.tagAccent};
      --tag-glow: ${theme.tagGlow};
      --tag-border: ${theme.tagBorder};
    }
  </style>
</head>
<body>
  ${renderHeader()}
  ${renderGallery({
    images: place.images,
    title: place.title,
    address: place.address,
    authorName: place.author_name,
    primaryTag: place.primaryTag,
    placeCount,
    breadcrumbTag: tagLabel,
  })}

  <div class="body-tint">
    <div class="content">
      ${sectionLabel}
      ${renderPlaceContent({
        description: place.seo_description,
        accessibility: place.accessibility,
        contributions,
      })}
    </div>

    ${renderNearbyPlaces(nearby)}
    ${renderFooter()}
  </div>
</body>
</html>`;
}
```

**Note importante :** le CSS est maintenant chargé via `<link rel="stylesheet" href="/assets/global.css" />` au lieu d'être inliné par Astro. Le fichier `global.css` sera copié dans `dist/assets/` par le build.

- [ ] **Step 2: Commit**

```bash
git add apps/seo-pages/src/templates/page.ts
git commit -m "feat(seo-pages): add full page template — core render function"
```

---

## Task 11: Build script (batch — remplace `astro build`)

**Files:**
- Create: `apps/seo-pages/src/build.ts`

- [ ] **Step 1: Créer le script de build**

```typescript
import { mkdir, writeFile, cp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAllPlacesWithSlugs, getPlaceContributions, getNearbyPlaces, getTotalPlaceCount } from './lib/places';
import { renderPage } from './templates/page';
import { renderSitemap } from './templates/sitemap';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

async function build() {
  const start = Date.now();
  console.log('Fetching places...');

  const [places, totalCount] = await Promise.all([
    getAllPlacesWithSlugs(),
    getTotalPlaceCount(),
  ]);
  const placeCount = Math.floor(totalCount / 100) * 100;

  console.log(`${places.length} places loaded. Generating HTML...`);

  // Préparer dist/
  await mkdir(join(DIST, 'lieu'), { recursive: true });
  await mkdir(join(DIST, 'assets'), { recursive: true });

  // Copier public/ dans dist/
  await cp(join(ROOT, 'public'), DIST, { recursive: true });

  // Copier global.css dans dist/assets/
  await cp(join(ROOT, 'src', 'styles', 'global.css'), join(DIST, 'assets', 'global.css'));

  // Générer les pages en parallèle par batches de 50
  const BATCH = 50;
  let generated = 0;

  for (let i = 0; i < places.length; i += BATCH) {
    const batch = places.slice(i, i + BATCH);
    await Promise.all(batch.map(async (place) => {
      const [contributions, nearby] = await Promise.all([
        getPlaceContributions(place.id),
        getNearbyPlaces(place.latitude, place.longitude, place.id),
      ]);

      const html = renderPage({ place, contributions, nearby, placeCount });
      const dir = join(DIST, 'lieu', place.slug);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'index.html'), html, 'utf-8');

      generated++;
      if (generated % 100 === 0) {
        console.log(`  ${generated}/${places.length}`);
      }
    }));
  }

  // Sitemap
  const sitemapXml = renderSitemap(places.map(p => p.slug));
  await writeFile(join(DIST, 'sitemap.xml'), sitemapXml, 'utf-8');

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDone: ${generated} pages + sitemap in ${elapsed}s`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Tester le build**

Run: `cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/seo-pages" && pnpm run build`

Expected: `Done: ~2612 pages + sitemap in Xs` (devrait être bien plus rapide que 8 min — objectif < 2 min)

- [ ] **Step 3: Vérifier une page générée**

Run: `cat dist/lieu/<un-slug-connu>/index.html | head -50`

Vérifier que le HTML est complet : DOCTYPE, meta tags, schema.org, hero, CSS link, etc.

- [ ] **Step 4: Commit**

```bash
git add apps/seo-pages/src/build.ts
git commit -m "feat(seo-pages): add node.js batch build — replaces astro build"
```

---

## Task 12: Pipeline unitaire (process-place.ts)

**Files:**
- Create: `apps/seo-pages/scripts/process-place.ts`

Ce script gère le pipeline complet pour un seul lieu : slug → seo → render → écriture. Utilisable en ligne de commande et importable comme module.

- [ ] **Step 1: Créer le script**

```typescript
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

import { getPlaceBySlug, getPlaceContributions, getNearbyPlaces, getTotalPlaceCount } from '../src/lib/places';
import { slugify } from '../src/lib/slugify';
import { renderPage } from '../src/templates/page';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

async function ensureSlug(placeId: string): Promise<string> {
  const { data } = await supabase
    .from('places')
    .select('id, title, slug, address')
    .eq('id', placeId)
    .single();

  if (!data) throw new Error(`Place ${placeId} not found`);
  if (data.slug) return data.slug;

  let slug = slugify(data.title);

  // Vérifier unicité
  const { data: existing } = await supabase
    .from('places')
    .select('slug')
    .eq('slug', slug)
    .single();

  if (existing && data.address) {
    const city = data.address.split(',').slice(-2, -1)[0]?.trim();
    if (city) slug = `${slug}-${slugify(city)}`;
  }

  let candidate = slug;
  let counter = 1;
  while (true) {
    const { data: dup } = await supabase
      .from('places')
      .select('slug')
      .eq('slug', candidate)
      .single();
    if (!dup) break;
    candidate = `${slug}-${counter}`;
    counter++;
  }

  await supabase.from('places').update({ slug: candidate }).eq('id', placeId);
  console.log(`  Slug: ${candidate}`);
  return candidate;
}

async function ensureSeoDescription(placeId: string): Promise<void> {
  const { data } = await supabase
    .from('places')
    .select('id, title, text, address, seo_description, place_types(title)')
    .eq('id', placeId)
    .single();

  if (!data) throw new Error(`Place ${placeId} not found`);
  if (data.seo_description) return;

  const { data: contribs } = await supabase
    .from('place_contributions')
    .select('content, votes_up, type')
    .eq('place_id', placeId)
    .eq('type', 'carnet')
    .order('votes_up', { ascending: false });

  const placeType = (data as any).place_types?.title ?? 'Lieu';
  const contribTexts = (contribs ?? [])
    .filter(c => c.content && c.content.trim().length > 10)
    .map((c, i) => `Récit ${i + 1} (${c.votes_up} votes, type: ${c.type}) : ${c.content}`)
    .join('\n\n');

  const prompt = `Tu es un rédacteur SEO pour Runes de Chêne, une application française de découverte de lieux historiques, naturels et patrimoniaux.

Écris une description SEO de 150 à 200 mots pour ce lieu. La description doit :
- Être factuelle et riche en mots-clés naturels (type de lieu, région, activités)
- Synthétiser les récits des visiteurs sans les copier mot pour mot
- Ne citer QUE des faits historiques vérifiables — en cas de doute, omettre plutôt qu'inventer
- Être engageante et donner envie de découvrir le lieu via l'application

**Lieu :** ${data.title}
**Type :** ${placeType}
**Adresse :** ${data.address || 'Non renseignée'}
**Description originale :** ${data.text || 'Aucune'}

**Récits des visiteurs :**
${contribTexts || 'Aucun récit disponible.'}

Écris UNIQUEMENT la description, sans titre ni balises.`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type');

  await supabase
    .from('places')
    .update({ seo_description: block.text.trim(), seo_generated_at: new Date().toISOString() })
    .eq('id', placeId);

  console.log(`  SEO: ${block.text.trim().length} chars`);
}

export async function processPlace(placeId: string): Promise<string> {
  console.log(`Processing place ${placeId}...`);

  // 1. Slug
  const slug = await ensureSlug(placeId);

  // 2. SEO description
  await ensureSeoDescription(placeId);

  // 3. Render
  const place = await getPlaceBySlug(slug);
  if (!place) throw new Error(`Place with slug ${slug} not found after processing`);

  const [contributions, nearby, totalCount] = await Promise.all([
    getPlaceContributions(place.id),
    getNearbyPlaces(place.latitude, place.longitude, place.id),
    getTotalPlaceCount(),
  ]);

  const placeCount = Math.floor(totalCount / 100) * 100;
  const html = renderPage({ place, contributions, nearby, placeCount });

  // 4. Write
  const dir = join(DIST, 'lieu', slug);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), html, 'utf-8');

  console.log(`  Written: dist/lieu/${slug}/index.html`);
  return slug;
}

// CLI
const placeId = process.argv[2];
if (placeId) {
  processPlace(placeId)
    .then(slug => console.log(`\nDone: /lieu/${slug}`))
    .catch(err => { console.error(err); process.exit(1); });
} else {
  console.error('Usage: tsx scripts/process-place.ts <place-id>');
  process.exit(1);
}
```

- [ ] **Step 2: Tester avec un lieu existant**

Récupérer un place ID depuis Supabase (un lieu qui a déjà slug + seo_description) et lancer :

Run: `cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/seo-pages" && pnpm run build:place <PLACE_ID>`

Expected: le fichier `dist/lieu/<slug>/index.html` est créé avec le HTML complet.

- [ ] **Step 3: Commit**

```bash
git add apps/seo-pages/scripts/process-place.ts
git commit -m "feat(seo-pages): add single-place pipeline (slug → seo → render)"
```

---

## Task 13: Nettoyage — Supprimer les fichiers Astro

**Files:**
- Delete: `apps/seo-pages/src/pages/` (tout le dossier)
- Delete: `apps/seo-pages/src/layouts/` (tout le dossier)
- Delete: `apps/seo-pages/src/components/` (tout le dossier)
- Delete: `apps/seo-pages/astro.config.mjs`

- [ ] **Step 1: Supprimer les fichiers Astro**

Run:
```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/seo-pages"
rm -rf src/pages src/layouts src/components astro.config.mjs
```

- [ ] **Step 2: Vérifier que le build fonctionne toujours**

Run: `pnpm run build`

Expected: build réussi, aucune erreur liée à Astro.

- [ ] **Step 3: Commit**

```bash
git add -A apps/seo-pages/
git commit -m "chore(seo-pages): remove astro files — migration complete"
```

---

## Task 14: Test de bout en bout + déploiement

- [ ] **Step 1: Full build + vérification visuelle**

Run: `cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/seo-pages" && pnpm run build`

Puis ouvrir un fichier HTML dans le navigateur pour vérifier visuellement :
```bash
start dist/lieu/<un-slug>/index.html
```

Vérifier :
- Le CSS se charge (si local, vérifier le lien `/assets/global.css`)
- Le hero affiche l'image
- Les thumbs fonctionnent
- Le lightbox s'ouvre
- Les contributions s'affichent
- Les lieux proches s'affichent
- Le footer est présent
- Le schema.org est dans le `<head>`

- [ ] **Step 2: Vérifier le sitemap**

Run: `head -20 dist/sitemap.xml`

Vérifier : XML valide, URLs en `https://carte.runesdechene.com/lieu/<slug>`

- [ ] **Step 3: Vérifier les fichiers statiques**

Run: `ls dist/assets/ && ls dist/app-icon.png dist/robots.txt dist/llms.txt`

Expected: `global.css` dans assets/, les fichiers public/ copiés à la racine.

- [ ] **Step 4: Commit + push**

```bash
git add -A apps/seo-pages/
git commit -m "feat(seo-pages): node.js migration complete — all astro removed"
git push
```

- [ ] **Step 5: Déployer sur Netlify**

Déclencher un deploy Netlify (manuellement ou via push) et vérifier que le site fonctionne en prod.

---

## Récapitulatif du pipeline final

```
NIGHTLY (cron 3h UTC) :
  generate:slugs → generate:seo → build → deploy Netlify
  (les nouveaux lieux sont ramassés automatiquement par le cron)
```

**Hors scope de ce plan (prochaines étapes) :**
- GitHub Actions nightly (`seo-nightly.yml`) — cron 3h UTC qui fait tout le pipeline
- Soumission sitemap à Google Search Console
