import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Place, Contribution, NearbyPlace } from '../lib/places';
import { deriveTheme } from '../lib/color';
import { renderHeader } from './header';
import { renderGallery } from './gallery';
import { renderPlaceContent } from './place-content';
import { renderNearbyPlaces } from './nearby-places';
import { renderFooter } from './footer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const globalCss = readFileSync(join(__dirname, '..', 'styles', 'global.css'), 'utf-8');

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
  shareTextTemplate: string;
}

export function renderPage(input: RenderPageInput): string {
  const { place, contributions, nearby, placeCount, shareTextTemplate } = input;

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
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cabin+Condensed:wght@400;500;600;700&family=Cabin:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" />
  <link rel="preconnect" href="https://ukpapqssgsxirsgmcvof.supabase.co" />
  <link rel="dns-prefetch" href="https://ukpapqssgsxirsgmcvof.supabase.co" />
  <link rel="icon" type="image/png" href="https://rdc-seo-pages.netlify.app/app-icon.png" />
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

  <style>
${globalCss}
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
  ${renderHeader({ placeName: place.title, placeSlug: place.slug, shareTextTemplate })}
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
        placeName: place.title,
        placeSlug: place.slug,
        shareTextTemplate,
      })}
    </div>

    ${renderNearbyPlaces(nearby)}
    ${renderFooter()}
  </div>
</body>
</html>`;
}
