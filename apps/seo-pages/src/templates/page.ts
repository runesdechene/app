/**
 * QUOI     — la page publique d'un lieu (maquettes Figma 566:614 téléphone, 566:752 ordinateur,
 *            validées par Uriel le 11/10) : la photo, la fiche telle que l'appli la lit, les lieux
 *            « Vous pourriez aussi aimer », le bas de page de la marque. Puis tout ce que Google lit : titre,
 *            description, Open Graph, schema.org.
 * POURQUOI — la page d'arrivée depuis Google : elle dit le lieu et mène à son aperçu sur la
 *            carte d'Explore, sans compte (le lieu est retenu jusqu'à l'inscription).
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Place, NearbyPlace } from '../lib/places';
import type { Fiche } from '../lib/fiche';
import { selectBodyDescription } from '../lib/seo';
import { echapper } from '../lib/texte';
import { renderPhoto } from './photo';
import { renderFiche } from './fiche';
import { renderProximite } from './proximite';
import { renderPied } from './pied';

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(__dirname, '..', 'styles', 'global.css'), 'utf-8');

const SITE = 'https://app.runesdechene.com';

interface RenderPageInput {
  place: Place;
  fiche: Fiche;
  nearby: NearbyPlace[];
  numeros: Map<string, string>;
  nombreDeLieux: number;
  texteDePartage: string;
}

export function renderPage(input: RenderPageInput): string {
  const { place, fiche, nearby, numeros, nombreDeLieux, texteDePartage } = input;

  const { description: recit } = selectBodyDescription(fiche.recit || place.text, place.seo_description);
  const metaDescription = (recit ?? '').replace(/\s+/g, ' ').slice(0, 155);
  const url = `${SITE}/lieu/${place.slug}`;
  const ou = place.departement ?? place.pays;
  const title = `${place.title}${ou ? `, ${ou}` : ''} — Runes de Chêne Explore`;
  const image = fiche.photos[0]?.url ?? place.images[0]?.url ?? null;

  const schemaOrg = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: place.title,
    description: metaDescription,
    address: fiche.adresse ?? undefined,
    geo: { '@type': 'GeoCoordinates', latitude: place.latitude, longitude: place.longitude },
    image: fiche.photos.map((p) => p.url),
    url,
    isAccessibleForFree: true,
    ...(fiche.auteur && { creator: { '@type': 'Person', name: fiche.auteur.nom } }),
  };
  const filAriane = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Runes de Chêne Explore', item: `${SITE}/bienvenue` },
      { '@type': 'ListItem', position: 2, name: place.title },
    ],
  };

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#fcf3e4" />
  <link rel="stylesheet" href="/lieu/_static/polices.css" />
  <link rel="preconnect" href="https://ukpapqssgsxirsgmcvof.supabase.co" />
  <link rel="icon" type="image/png" href="https://rdc-seo-pages.netlify.app/app-icon.png" />
  <title>${echapper(title)}</title>
  <meta name="description" content="${echapper(metaDescription)}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:title" content="${echapper(title)}" />
  <meta property="og:description" content="${echapper(metaDescription)}" />
  ${image ? `<meta property="og:image" content="${echapper(image)}" />` : ''}
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="fr_FR" />
  <meta property="og:site_name" content="Runes de Chêne" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify(schemaOrg)}</script>
  <script type="application/ld+json">${JSON.stringify(filAriane)}</script>
  <style>
${css}
  </style>
</head>
<body>
  ${renderPhoto({ nom: place.title, photos: fiche.photos, texteDePartage, url })}
  <main class="contenu">
    ${renderFiche({ place, fiche, recit, numeros, nombreDeLieux })}
    ${renderProximite(nearby, numeros)}
  </main>
  ${renderPied()}
</body>
</html>`;
}
