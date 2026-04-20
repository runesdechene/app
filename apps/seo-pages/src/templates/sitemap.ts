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
