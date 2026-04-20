# SEO Pages Redesign — "Guide du Patrimoine" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the SEO pages (`apps/seo-pages/`) from a generic blog layout to a split 40/60 "Guide du Patrimoine" with tag-driven color identity, gallery, contribution cards, and breadcrumb SEO.

**Architecture:** Astro 5 SSG, Supabase data layer enriched with tags. Split layout: sticky gallery left (40%), structured content right (60%). Tag dominant color tints each page. All styling in a single `global.css`.

**Tech Stack:** Astro 5, Supabase JS, CSS (no Tailwind in seo-pages), Google Fonts (Bebas Neue, Cabin, Cabin Condensed)

**Spec:** `docs/superpowers/specs/2026-04-20-seo-pages-lieux-design.md`
**Mockup:** `.superpowers/brainstorm/11873-1776707996/content/full-mockup.html`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/lib/places.ts` | Add PlaceTag type, tags join, pagination fix |
| Rewrite | `src/styles/global.css` | Full CSS rewrite — new palette, split layout, all components |
| Modify | `src/layouts/Base.astro` | Add tagDominantColor prop, BreadcrumbList JSON-LD |
| Rewrite | `src/pages/lieu/[slug].astro` | New page structure with split layout |
| Rewrite | `src/components/Header.astro` | Logo image + CTA, minimal sticky |
| Create | `src/components/Breadcrumb.astro` | Breadcrumb nav + schema.org JSON-LD |
| Create | `src/components/Gallery.astro` | Sticky photo 3:4 + dots + thumbnails |
| Create | `src/components/TagPills.astro` | Hierarchical tag pills with SVG icons |
| Rewrite | `src/components/PlaceContent.astro` | Description + featured contribution + accordion |
| Create | `src/components/ContributionCard.astro` | Single contribution "carnet entry" card |
| Rewrite | `src/components/CtaDownload.astro` | Contextual CTA with logo |
| Rewrite | `src/components/NearbyPlaces.astro` | 4-col grid with typed cards |
| Rewrite | `src/components/Footer.astro` | Logo + brand text + nav links |
| Delete | `src/components/Hero.astro` | Replaced by Gallery |
| Delete | `src/components/ValuesBar.astro` | Replaced by TagPills |
| Delete | `src/components/PlaceInfo.astro` | Accessibility folded into PlaceContent |
| Delete | `src/components/BrandBlock.astro` | Merged into Footer |

---

### Task 1: Data Layer — Add tags + fix pagination

**Files:**
- Modify: `apps/seo-pages/src/lib/places.ts`

- [ ] **Step 1: Add PlaceTag type and update Place interface**

Add after the existing `PlaceType` interface:

```ts
export interface PlaceTag {
  id: string;
  title: string;
  color: string;
  background: string;
  icon: string | null;
  isPrimary: boolean;
}
```

Update `Place` interface — add these fields:

```ts
export interface Place {
  // ... existing fields ...
  tags: PlaceTag[];
  primaryTag: PlaceTag | null;
}
```

- [ ] **Step 2: Rewrite `getAllPlacesWithSlugs()` with pagination and tags**

Replace the entire function with:

```ts
export async function getAllPlacesWithSlugs(): Promise<Place[]> {
  const PAGE_SIZE = 1000;
  let allPlaces: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('places')
      .select(`
        id, title, text, slug, address, latitude, longitude,
        images, accessibility, sensible, seo_description,
        place_types!inner ( id, title, color, images )
      `)
      .not('slug', 'is', null)
      .eq('private', false)
      .eq('masked', false)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    allPlaces = allPlaces.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const placeIds = allPlaces.map((p: any) => p.id);

  const { data: tagRows, error: tagErr } = await supabase
    .from('place_tags')
    .select('place_id, is_primary, tags(id, title, color, background, icon)')
    .in('place_id', placeIds);

  if (tagErr) throw tagErr;

  const tagsMap = new Map<string, PlaceTag[]>();
  for (const r of (tagRows ?? []) as unknown as Array<{
    place_id: string;
    is_primary: boolean;
    tags: { id: string; title: string; color: string; background: string; icon: string | null } | null;
  }>) {
    if (!r.tags) continue;
    const arr = tagsMap.get(r.place_id) ?? [];
    arr.push({
      id: r.tags.id,
      title: r.tags.title,
      color: r.tags.color,
      background: r.tags.background,
      icon: r.tags.icon,
      isPrimary: r.is_primary,
    });
    tagsMap.set(r.place_id, arr);
  }

  return allPlaces.map((row: any) => {
    const tags = tagsMap.get(row.id) ?? [];
    const primary = tags.find(t => t.isPrimary) ?? tags[0] ?? null;
    return {
      id: row.id,
      title: row.title,
      text: row.text,
      slug: row.slug,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      images: row.images ?? [],
      accessibility: row.accessibility,
      sensible: row.sensible,
      seo_description: row.seo_description,
      place_type: row.place_types,
      author_name: '',
      tags,
      primaryTag: primary,
    };
  });
}
```

- [ ] **Step 3: Also paginate the tags query (placeIds can exceed 1000)**

The `placeIds` array can be >1000 which exceeds Supabase's `.in()` limit. Batch the tags query:

```ts
  // Replace the single tags query with batched version:
  const tagsMap = new Map<string, PlaceTag[]>();
  for (let i = 0; i < placeIds.length; i += PAGE_SIZE) {
    const batch = placeIds.slice(i, i + PAGE_SIZE);
    const { data: tagRows, error: tagErr } = await supabase
      .from('place_tags')
      .select('place_id, is_primary, tags(id, title, color, background, icon)')
      .in('place_id', batch);

    if (tagErr) throw tagErr;

    for (const r of (tagRows ?? []) as unknown as Array<{
      place_id: string;
      is_primary: boolean;
      tags: { id: string; title: string; color: string; background: string; icon: string | null } | null;
    }>) {
      if (!r.tags) continue;
      const arr = tagsMap.get(r.place_id) ?? [];
      arr.push({
        id: r.tags.id,
        title: r.tags.title,
        color: r.tags.color,
        background: r.tags.background,
        icon: r.tags.icon,
        isPrimary: r.is_primary,
      });
      tagsMap.set(r.place_id, arr);
    }
  }
```

- [ ] **Step 4: Update `getNearbyPlaces` return type to include tags**

The nearby places also need `place_type` for the type label on cards. The current implementation already returns `place_type`. No changes needed — the existing return type `Pick<Place, 'title' | 'slug' | 'images' | 'place_type'>` already covers what NearbyPlaces needs.

- [ ] **Step 5: Verify build compiles**

Run: `cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/seo-pages" && npx astro check 2>&1 | head -20`

Expected: No type errors related to `places.ts` (page will have errors until we update `[slug].astro`)

- [ ] **Step 6: Commit**

```bash
git add apps/seo-pages/src/lib/places.ts
git commit -m "feat(seo): add tags to data layer + fix 1000-row pagination"
```

---

### Task 2: CSS — Full rewrite of `global.css`

**Files:**
- Rewrite: `apps/seo-pages/src/styles/global.css`

- [ ] **Step 1: Write the complete new `global.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cabin+Condensed:wght@400;500;600;700&family=Cabin:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');

/* === 1. Variables & Reset === */
:root {
  --parchment: #f7ede1;
  --parchment-dark: #E8D5BE;
  --ink: #4A3728;
  --ink-light: #7D5A3C;
  --sepia: #C19A6B;
  --sepia-dark: #A0784C;
  --accent: #833434;
  --accent-hover: #6b2828;

  --tag-dominant: #C19A6B;
  --tag-dominant-bg: rgba(193, 154, 107, 0.07);

  --font-title: 'Bebas Neue', sans-serif;
  --font-accent: 'Cabin Condensed', sans-serif;
  --font-body: 'Cabin', sans-serif;
  --max-width: 1200px;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: var(--font-body);
  background: var(--parchment);
  color: var(--ink);
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
img { max-width: 100%; height: auto; display: block; }

/* === 2. Header & Breadcrumb === */
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--parchment);
  border-bottom: 1px solid var(--parchment-dark);
}

.header-inner {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 12px 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-logo img {
  height: 26px;
  width: auto;
}

.header-cta {
  background: var(--accent);
  color: #fff;
  padding: 8px 20px;
  border-radius: 6px;
  font-family: var(--font-accent);
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-decoration: none;
  transition: background 0.2s;
}

.header-cta:hover {
  background: var(--accent-hover);
  text-decoration: none;
}

.breadcrumb {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 10px 32px;
  font-family: var(--font-accent);
  font-size: 13px;
  color: var(--ink-light);
  border-bottom: 1px solid var(--parchment-dark);
}

.breadcrumb a {
  color: var(--sepia-dark);
  text-decoration: none;
}

.breadcrumb a:hover { text-decoration: underline; }
.breadcrumb .sep { margin: 0 8px; opacity: 0.4; }
.breadcrumb .current { color: var(--ink); font-weight: 600; }

/* === 3. Page Tint (tag dominant gradient) === */
.page-tint {
  background: linear-gradient(180deg, var(--tag-dominant-bg) 0%, var(--parchment) 320px);
}

/* === 4. Split Layout === */
.main-split {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 32px;
  display: grid;
  grid-template-columns: 40% 1fr;
  gap: 40px;
}

/* === 5. Gallery === */
.gallery {
  position: sticky;
  top: 80px;
  align-self: start;
}

.gallery-main {
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 12px;
  overflow: hidden;
  background: var(--parchment-dark);
  position: relative;
}

.gallery-main img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gallery-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--sepia) 0%, var(--sepia-dark) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  font-family: var(--font-accent);
  font-size: 14px;
}

.gallery-dots {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
}

.gallery-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  border: none;
  cursor: pointer;
  padding: 0;
  transition: background 0.2s;
}

.gallery-dot.active {
  background: rgba(255, 255, 255, 0.95);
}

.gallery-thumbs {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.gallery-thumb {
  flex: 1;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background: var(--parchment-dark);
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
  border: 2px solid transparent;
}

.gallery-thumb.active {
  opacity: 1;
  border-color: var(--sepia);
}

.gallery-thumb:hover { opacity: 1; }

.gallery-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* === 6. Content === */
.content-col {
  display: flex;
  flex-direction: column;
}

.place-type-label {
  font-family: var(--font-accent);
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--accent);
  margin-bottom: 8px;
}

.place-title {
  font-family: var(--font-title);
  font-size: 52px;
  line-height: 1.05;
  color: var(--ink);
  letter-spacing: 0.01em;
  margin-bottom: 6px;
}

.place-address {
  font-size: 15px;
  color: var(--ink-light);
  margin-bottom: 16px;
}

.place-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 28px;
  align-items: center;
}

.place-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 20px;
  font-family: var(--font-accent);
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.03em;
}

.place-tag.primary {
  padding: 7px 18px;
  font-size: 14px;
  font-weight: 700;
}

.place-tag-icon {
  width: 14px;
  height: 14px;
  display: inline-block;
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
}

.place-tag.primary .place-tag-icon {
  width: 16px;
  height: 16px;
}

.content-divider {
  width: 60px;
  height: 2px;
  background: var(--parchment-dark);
  margin: 4px 0 28px 0;
  border: none;
}

.place-description {
  font-size: 17px;
  line-height: 1.9;
  color: var(--ink);
  margin-bottom: 32px;
}

.place-accessibility {
  font-size: 14px;
  color: var(--ink-light);
  margin-top: -16px;
  margin-bottom: 32px;
  padding: 12px 16px;
  background: var(--parchment-dark);
  border-radius: 8px;
}

.place-accessibility strong {
  font-family: var(--font-accent);
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.08em;
  display: block;
  margin-bottom: 4px;
  color: var(--ink);
}

/* === 7. Contributions === */
.section-label {
  font-family: var(--font-accent);
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--accent);
  margin-bottom: 16px;
}

.contribution-card {
  background: var(--parchment-dark);
  border-radius: 12px;
  padding: 24px;
  border-left: 4px solid var(--accent);
}

.contribution-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.contribution-author {
  display: flex;
  align-items: center;
  gap: 10px;
}

.contribution-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--sepia);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-family: var(--font-accent);
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
}

.contribution-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.contribution-name {
  font-family: var(--font-accent);
  font-weight: 700;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink);
}

.contribution-date {
  font-size: 12px;
  color: var(--ink-light);
}

.contribution-votes {
  font-family: var(--font-accent);
  font-size: 14px;
  font-weight: 700;
  color: var(--accent);
}

.contribution-title {
  font-weight: 600;
  font-size: 16px;
  margin-bottom: 8px;
}

.contribution-text {
  font-size: 16px;
  line-height: 1.8;
  color: var(--ink-light);
  font-style: italic;
}

.contribution-images {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.contribution-images img {
  width: 100px;
  height: 75px;
  object-fit: cover;
  border-radius: 6px;
}

.contributions-toggle {
  display: block;
  width: 100%;
  margin-top: 12px;
  background: none;
  border: 1px solid var(--parchment-dark);
  border-radius: 8px;
  padding: 12px 24px;
  font-family: var(--font-accent);
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-light);
  cursor: pointer;
  transition: all 0.2s;
}

.contributions-toggle:hover {
  border-color: var(--sepia);
  color: var(--ink);
}

.contributions-hidden {
  display: none;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.contributions-hidden.open {
  display: flex;
}

/* === 8. CTA Contextuel === */
.cta-contextual {
  background: linear-gradient(135deg, var(--ink) 0%, #2a1f17 100%);
  border-radius: 12px;
  padding: 36px;
  text-align: center;
  margin-top: 8px;
  margin-bottom: 32px;
}

.cta-logo {
  height: 24px;
  width: auto;
  margin: 0 auto 16px;
  opacity: 0.6;
}

.cta-contextual h3 {
  font-family: var(--font-title);
  font-size: 32px;
  color: var(--parchment);
  margin-bottom: 8px;
  letter-spacing: 0.02em;
}

.cta-contextual p {
  font-size: 15px;
  color: var(--sepia);
  margin-bottom: 20px;
  line-height: 1.6;
}

.cta-button {
  display: inline-block;
  background: var(--accent);
  color: #fff;
  padding: 12px 32px;
  border-radius: 8px;
  font-family: var(--font-accent);
  font-weight: 700;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-decoration: none;
  transition: background 0.2s;
}

.cta-button:hover {
  background: var(--accent-hover);
  text-decoration: none;
}

/* === 9. Nearby Grid === */
.nearby-section {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 32px 48px;
}

.nearby-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-top: 16px;
}

.nearby-card {
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  transition: transform 0.2s, box-shadow 0.2s;
  text-decoration: none;
  color: inherit;
}

.nearby-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(74, 55, 40, 0.12);
  text-decoration: none;
}

.nearby-card-img {
  width: 100%;
  height: 140px;
  object-fit: cover;
  background: var(--parchment-dark);
}

.nearby-card-body {
  padding: 14px;
}

.nearby-card-type {
  font-family: var(--font-accent);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--accent);
  margin-bottom: 4px;
}

.nearby-card-name {
  font-family: var(--font-accent);
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
}

/* === 10. Footer === */
.site-footer {
  border-top: 1px solid var(--parchment-dark);
  padding: 40px 32px;
  text-align: center;
}

.footer-logo img {
  height: 28px;
  width: auto;
  margin: 0 auto 16px;
}

.footer-text {
  font-size: 15px;
  color: var(--ink-light);
  max-width: 480px;
  margin: 0 auto 24px;
  line-height: 1.7;
}

.footer-links {
  display: flex;
  gap: 24px;
  justify-content: center;
  flex-wrap: wrap;
  font-family: var(--font-accent);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.footer-links a {
  color: var(--ink-light);
  text-decoration: none;
}

.footer-links a:hover { color: var(--accent); }

.footer-copy {
  margin-top: 20px;
  font-size: 12px;
  color: var(--ink-light);
  opacity: 0.6;
}

/* === 11. Mobile === */
@media (max-width: 768px) {
  .main-split {
    grid-template-columns: 1fr;
    gap: 24px;
    padding: 20px;
  }

  .gallery {
    position: static;
  }

  .gallery-main {
    aspect-ratio: 4 / 3;
  }

  .place-title {
    font-size: 38px;
  }

  .nearby-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .header-inner {
    padding: 12px 20px;
  }

  .breadcrumb {
    padding: 8px 20px;
    font-size: 12px;
  }

  .nearby-section {
    padding: 0 20px 32px;
  }

  .site-footer {
    padding: 32px 20px;
  }

  .cta-contextual {
    padding: 28px 20px;
  }

  .cta-contextual h3 {
    font-size: 26px;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/seo-pages/src/styles/global.css
git commit -m "feat(seo): rewrite global.css for Guide du Patrimoine design"
```

---

### Task 3: Layout — Update `Base.astro`

**Files:**
- Modify: `apps/seo-pages/src/layouts/Base.astro`

- [ ] **Step 1: Add tagDominantColor prop and BreadcrumbList JSON-LD slot**

Replace the entire file:

```astro
---
import '../styles/global.css';

interface Props {
  title: string;
  description: string;
  image?: string;
  canonicalUrl: string;
  schemaOrg?: Record<string, any>;
  breadcrumbSchema?: Record<string, any>;
  tagDominantColor?: string;
}

const { title, description, image, canonicalUrl, schemaOrg, breadcrumbSchema, tagDominantColor } = Astro.props;
const ogImage = image || '/og-default.png';

const dominantColor = tagDominantColor || '#C19A6B';
const dominantBg = `${dominantColor}12`;
---

<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonicalUrl} />

  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="fr_FR" />
  <meta property="og:site_name" content="Runes de Chêne" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={ogImage} />

  {schemaOrg && (
    <script type="application/ld+json" set:html={JSON.stringify(schemaOrg)} />
  )}
  {breadcrumbSchema && (
    <script type="application/ld+json" set:html={JSON.stringify(breadcrumbSchema)} />
  )}

  <style define:vars={{ dominantColor, dominantBg }}>
    :root {
      --tag-dominant: var(--dominantColor);
      --tag-dominant-bg: var(--dominantBg);
    }
  </style>
</head>
<body>
  <slot />
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add apps/seo-pages/src/layouts/Base.astro
git commit -m "feat(seo): Base layout with tag dominant color + breadcrumb schema"
```

---

### Task 4: Components — Header + Breadcrumb

**Files:**
- Rewrite: `apps/seo-pages/src/components/Header.astro`
- Create: `apps/seo-pages/src/components/Breadcrumb.astro`

- [ ] **Step 1: Rewrite Header.astro**

```astro
---
---
<header class="site-header">
  <div class="header-inner">
    <a href="https://carte.runesdechene.com" class="header-logo">
      <img
        src="https://runesdechene.com/cdn/shop/files/LOGO_ligne_marron.webp"
        alt="Runes de Chêne"
        loading="eager"
      />
    </a>
    <a href="https://carte.runesdechene.com" class="header-cta">Ouvrir dans l'app</a>
  </div>
</header>
```

- [ ] **Step 2: Create Breadcrumb.astro**

```astro
---
interface Props {
  placeType: string;
  placeName: string;
}

const { placeType, placeName } = Astro.props;
---
<nav class="breadcrumb">
  <a href="https://carte.runesdechene.com">La Carte</a>
  <span class="sep">›</span>
  <a href={`https://carte.runesdechene.com/lieu?type=${encodeURIComponent(placeType.toLowerCase())}`}>{placeType}</a>
  <span class="sep">›</span>
  <span class="current">{placeName}</span>
</nav>
```

- [ ] **Step 3: Commit**

```bash
git add apps/seo-pages/src/components/Header.astro apps/seo-pages/src/components/Breadcrumb.astro
git commit -m "feat(seo): Header with logo + Breadcrumb component"
```

---

### Task 5: Components — Gallery

**Files:**
- Create: `apps/seo-pages/src/components/Gallery.astro`

- [ ] **Step 1: Create Gallery.astro**

```astro
---
interface Props {
  images: Array<{ id: string; url: string; thumb?: string }>;
  title: string;
}

const { images, title } = Astro.props;
const mainImage = images[0] ?? null;
const thumbImages = images.slice(0, 5);
---
<aside class="gallery">
  <div class="gallery-main">
    {mainImage ? (
      <img src={mainImage.url} alt={title} loading="eager" />
    ) : (
      <div class="gallery-placeholder">
        <span>Aucune photo</span>
      </div>
    )}
    {images.length > 1 && (
      <div class="gallery-dots">
        {images.slice(0, 5).map((_, i) => (
          <button
            class={`gallery-dot${i === 0 ? ' active' : ''}`}
            aria-label={`Photo ${i + 1}`}
          />
        ))}
      </div>
    )}
  </div>
  {thumbImages.length > 1 && (
    <div class="gallery-thumbs">
      {thumbImages.map((img, i) => (
        <div class={`gallery-thumb${i === 0 ? ' active' : ''}`}>
          <img src={img.thumb || img.url} alt={`${title} — photo ${i + 1}`} loading="lazy" />
        </div>
      ))}
    </div>
  )}
</aside>
```

Note: Gallery dots and thumbs are visual-only for SSG (no JS interactivity). The active state shows the first image. For full interactivity, a client-side script could be added later.

- [ ] **Step 2: Commit**

```bash
git add apps/seo-pages/src/components/Gallery.astro
git commit -m "feat(seo): Gallery component with thumbnails"
```

---

### Task 6: Components — TagPills + ContributionCard

**Files:**
- Create: `apps/seo-pages/src/components/TagPills.astro`
- Create: `apps/seo-pages/src/components/ContributionCard.astro`

- [ ] **Step 1: Create TagPills.astro**

```astro
---
import type { PlaceTag } from '../lib/places';

interface Props {
  tags: PlaceTag[];
}

const { tags } = Astro.props;
const sorted = [...tags].sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : 0));
---
{sorted.length > 0 && (
  <div class="place-tags">
    {sorted.map((tag) => (
      <span
        class={`place-tag${tag.isPrimary ? ' primary' : ''}`}
        style={`background: ${tag.background}; color: ${tag.color};`}
      >
        {tag.icon && (
          <span
            class="place-tag-icon"
            style={`background-color: ${tag.color}; -webkit-mask-image: url(${tag.icon}); mask-image: url(${tag.icon});`}
          />
        )}
        {tag.title}
      </span>
    ))}
  </div>
)}
```

- [ ] **Step 2: Create ContributionCard.astro**

```astro
---
import type { Contribution } from '../lib/places';

interface Props {
  contribution: Contribution;
}

const { contribution: c } = Astro.props;
const initial = c.user_name.charAt(0).toUpperCase();
const dateStr = new Date(c.created_at).toLocaleDateString('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
---
<div class="contribution-card">
  <div class="contribution-header">
    <div class="contribution-author">
      <div class="contribution-avatar">
        {c.user_avatar ? (
          <img src={c.user_avatar} alt={c.user_name} loading="lazy" />
        ) : (
          initial
        )}
      </div>
      <div>
        <div class="contribution-name">{c.user_name}</div>
        <div class="contribution-date">{dateStr}</div>
      </div>
    </div>
    {c.votes_up > 0 && (
      <div class="contribution-votes">+{c.votes_up}</div>
    )}
  </div>
  {c.title && <p class="contribution-title">{c.title}</p>}
  <p class="contribution-text">&laquo; {c.content} &raquo;</p>
  {c.images.length > 0 && (
    <div class="contribution-images">
      {c.images.slice(0, 4).map((url) => (
        <img src={url} alt="Photo du lieu" loading="lazy" />
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/seo-pages/src/components/TagPills.astro apps/seo-pages/src/components/ContributionCard.astro
git commit -m "feat(seo): TagPills and ContributionCard components"
```

---

### Task 7: Components — PlaceContent (description + contributions)

**Files:**
- Rewrite: `apps/seo-pages/src/components/PlaceContent.astro`

- [ ] **Step 1: Rewrite PlaceContent.astro**

```astro
---
import type { Contribution } from '../lib/places';
import ContributionCard from './ContributionCard.astro';

interface Props {
  description: string | null;
  accessibility: string | null;
  contributions: Contribution[];
}

const { description, accessibility, contributions } = Astro.props;
const featured = contributions[0] ?? null;
const remaining = contributions.slice(1);
---
<div>
  {description && (
    <div class="place-description">
      <Fragment set:html={description.replace(/\n\n/g, '</p><p>').replace(/^/, '<p>').replace(/$/, '</p>')} />
    </div>
  )}

  {accessibility && (
    <div class="place-accessibility">
      <strong>Accessibilité</strong>
      {accessibility}
    </div>
  )}

  {featured && (
    <div style="margin-bottom: 32px;">
      <div class="section-label">Récit d'explorateur</div>
      <ContributionCard contribution={featured} />
      {remaining.length > 0 && (
        <>
          <button
            class="contributions-toggle"
            onclick="this.nextElementSibling.classList.toggle('open'); this.style.display='none';"
          >
            Voir les {remaining.length} autre{remaining.length > 1 ? 's' : ''} récit{remaining.length > 1 ? 's' : ''}
          </button>
          <div class="contributions-hidden">
            {remaining.map((c) => (
              <ContributionCard contribution={c} />
            ))}
          </div>
        </>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add apps/seo-pages/src/components/PlaceContent.astro
git commit -m "feat(seo): PlaceContent with featured contribution + accordion"
```

---

### Task 8: Components — CtaDownload, NearbyPlaces, Footer

**Files:**
- Rewrite: `apps/seo-pages/src/components/CtaDownload.astro`
- Rewrite: `apps/seo-pages/src/components/NearbyPlaces.astro`
- Rewrite: `apps/seo-pages/src/components/Footer.astro`

- [ ] **Step 1: Rewrite CtaDownload.astro**

```astro
---
interface Props {
  placeName: string;
}

const { placeName } = Astro.props;
---
<div class="cta-contextual">
  <img
    src="https://runesdechene.com/cdn/shop/files/LOGO_ligne_marron.webp"
    alt="Runes de Chêne"
    class="cta-logo"
    loading="lazy"
    style="filter: brightness(2);"
  />
  <h3>Explorez {placeName}</h3>
  <p>Ajoutez vos photos, partagez votre récit et gagnez de la Gloire pour votre Héritage.</p>
  <a href="https://carte.runesdechene.com" class="cta-button">Découvrir sur l'app</a>
</div>
```

- [ ] **Step 2: Rewrite NearbyPlaces.astro**

```astro
---
interface NearbyPlace {
  title: string;
  slug: string;
  images: { id: string; url: string; thumb?: string }[];
  place_type: { title: string; color?: string };
}

interface Props {
  places: NearbyPlace[];
}

const { places } = Astro.props;
---
{places.length > 0 && (
  <section class="nearby-section">
    <div class="section-label">Lieux à proximité</div>
    <div class="nearby-grid">
      {places.map((place) => (
        <a href={`/lieu/${place.slug}`} class="nearby-card">
          {place.images?.[0]?.url ? (
            <img
              src={place.images[0].thumb || place.images[0].url}
              alt={place.title}
              loading="lazy"
              class="nearby-card-img"
            />
          ) : (
            <div class="nearby-card-img" />
          )}
          <div class="nearby-card-body">
            <div class="nearby-card-type">{place.place_type.title}</div>
            <div class="nearby-card-name">{place.title}</div>
          </div>
        </a>
      ))}
    </div>
  </section>
)}
```

- [ ] **Step 3: Rewrite Footer.astro**

```astro
---
---
<footer class="site-footer">
  <div class="footer-logo">
    <img
      src="https://runesdechene.com/cdn/shop/files/LOGO_ligne_marron.webp"
      alt="Runes de Chêne"
      loading="lazy"
    />
  </div>
  <p class="footer-text">
    Un mouvement né de la passion pour l'histoire, la nature et le patrimoine français.
    Des milliers de lieux remarquables découverts par une communauté d'explorateurs.
  </p>
  <nav class="footer-links">
    <a href="https://carte.runesdechene.com">La Carte</a>
    <a href="https://www.runesdechene.com">La Boutique</a>
    <a href="https://www.instagram.com/runesdechene" target="_blank" rel="noopener">Instagram</a>
    <a href="https://carte.runesdechene.com">Télécharger l'app</a>
  </nav>
  <p class="footer-copy">&copy; {new Date().getFullYear()} Runes de Chêne</p>
</footer>
```

- [ ] **Step 4: Commit**

```bash
git add apps/seo-pages/src/components/CtaDownload.astro apps/seo-pages/src/components/NearbyPlaces.astro apps/seo-pages/src/components/Footer.astro
git commit -m "feat(seo): CTA contextual + NearbyPlaces grid + Footer with logo"
```

---

### Task 9: Page Assembly — Rewrite `[slug].astro`

**Files:**
- Rewrite: `apps/seo-pages/src/pages/lieu/[slug].astro`

- [ ] **Step 1: Rewrite the page**

```astro
---
import Base from '../../layouts/Base.astro';
import Header from '../../components/Header.astro';
import Breadcrumb from '../../components/Breadcrumb.astro';
import Gallery from '../../components/Gallery.astro';
import TagPills from '../../components/TagPills.astro';
import PlaceContent from '../../components/PlaceContent.astro';
import CtaDownload from '../../components/CtaDownload.astro';
import NearbyPlaces from '../../components/NearbyPlaces.astro';
import Footer from '../../components/Footer.astro';
import { getAllPlacesWithSlugs, getPlaceContributions, getNearbyPlaces } from '../../lib/places';
import type { Place, Contribution } from '../../lib/places';

export async function getStaticPaths() {
  const places = await getAllPlacesWithSlugs();

  return places.map((place) => ({
    params: { slug: place.slug },
    props: { place },
  }));
}

interface Props {
  place: Place;
}

const { place } = Astro.props;

const contributions: Contribution[] = await getPlaceContributions(place.id);
const nearby = await getNearbyPlaces(place.latitude, place.longitude, place.id);

const firstImageUrl = place.images?.[0]?.url ?? null;
const metaDescription = (place.seo_description || place.text || '').slice(0, 155);
const canonicalUrl = `https://carte.runesdechene.com/lieu/${place.slug}`;

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
  image: firstImageUrl || undefined,
  url: canonicalUrl,
  isAccessibleForFree: true,
  touristType: 'Nature & Heritage',
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'La Carte',
      item: 'https://carte.runesdechene.com',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: place.place_type.title,
      item: `https://carte.runesdechene.com/lieu?type=${encodeURIComponent(place.place_type.title.toLowerCase())}`,
    },
    {
      '@type': 'ListItem',
      position: 3,
      name: place.title,
    },
  ],
};
---

<Base
  title={`${place.title} — Runes de Chêne`}
  description={metaDescription}
  image={firstImageUrl ?? undefined}
  canonicalUrl={canonicalUrl}
  schemaOrg={schemaOrg}
  breadcrumbSchema={breadcrumbSchema}
  tagDominantColor={place.primaryTag?.color}
>
  <Header />
  <Breadcrumb placeType={place.place_type.title} placeName={place.title} />
  <div class="page-tint">
    <main class="main-split">
      <Gallery images={place.images} title={place.title} />
      <article class="content-col">
        <span class="place-type-label">{place.place_type.title}</span>
        <h1 class="place-title">{place.title}</h1>
        {place.address && <p class="place-address">{place.address}</p>}
        <TagPills tags={place.tags} />
        <hr class="content-divider" />
        <PlaceContent
          description={place.seo_description || place.text}
          accessibility={place.accessibility}
          contributions={contributions}
        />
        <CtaDownload placeName={place.title} />
      </article>
    </main>
  </div>
  <NearbyPlaces places={nearby} />
  <Footer />
</Base>
```

- [ ] **Step 2: Commit**

```bash
git add apps/seo-pages/src/pages/lieu/\[slug\].astro
git commit -m "feat(seo): assemble new page layout with split design"
```

---

### Task 10: Cleanup — Delete old components

**Files:**
- Delete: `apps/seo-pages/src/components/Hero.astro`
- Delete: `apps/seo-pages/src/components/ValuesBar.astro`
- Delete: `apps/seo-pages/src/components/PlaceInfo.astro`
- Delete: `apps/seo-pages/src/components/BrandBlock.astro`
- Delete: `apps/seo-pages/src/pages/design-preview.astro`

- [ ] **Step 1: Delete obsolete files**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
rm apps/seo-pages/src/components/Hero.astro
rm apps/seo-pages/src/components/ValuesBar.astro
rm apps/seo-pages/src/components/PlaceInfo.astro
rm apps/seo-pages/src/components/BrandBlock.astro
rm apps/seo-pages/src/pages/design-preview.astro
```

- [ ] **Step 2: Commit**

```bash
git add -u apps/seo-pages/src/components/Hero.astro apps/seo-pages/src/components/ValuesBar.astro apps/seo-pages/src/components/PlaceInfo.astro apps/seo-pages/src/components/BrandBlock.astro apps/seo-pages/src/pages/design-preview.astro
git commit -m "chore(seo): remove obsolete components (Hero, ValuesBar, PlaceInfo, BrandBlock, design-preview)"
```

---

### Task 11: Build Verification + Visual Test

- [ ] **Step 1: Run Astro build**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/seo-pages"
npx astro build 2>&1 | tail -20
```

Expected: Build succeeds, generates 2500+ pages.

- [ ] **Step 2: Run dev server and test in browser**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/seo-pages"
npx astro dev --port 4322
```

Open `http://localhost:4322/lieu/[any-slug]` and verify:
- Split layout renders (gallery left, content right)
- Tag pills show with correct colors
- Page tint gradient visible at top
- Breadcrumb displays correctly
- Contribution card renders with avatar/votes
- CTA shows with logo
- Nearby grid shows 4 cards
- Footer has logo
- Resize to mobile: layout stacks, gallery becomes 4:3

- [ ] **Step 3: Final commit with all verified**

```bash
git add -A apps/seo-pages/
git commit -m "feat(seo): complete Guide du Patrimoine redesign — verified"
git push
```
