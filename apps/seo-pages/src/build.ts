import { mkdir, writeFile, cp, rm } from 'node:fs/promises';
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

  await rm(DIST, { recursive: true, force: true });

  console.log('Fetching places...');

  const [places, totalCount] = await Promise.all([
    getAllPlacesWithSlugs(),
    getTotalPlaceCount(),
  ]);
  const placeCount = Math.floor(totalCount / 100) * 100;

  console.log(`${places.length} places loaded. Generating HTML...`);

  await mkdir(join(DIST, 'lieu'), { recursive: true });
  await mkdir(join(DIST, 'assets'), { recursive: true });

  await cp(join(ROOT, 'public'), DIST, { recursive: true });
  await cp(join(ROOT, 'src', 'styles', 'global.css'), join(DIST, 'assets', 'global.css'));

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

  const sitemapXml = renderSitemap(places.map(p => p.slug));
  await writeFile(join(DIST, 'sitemap.xml'), sitemapXml, 'utf-8');

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDone: ${generated} pages + sitemap in ${elapsed}s`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
