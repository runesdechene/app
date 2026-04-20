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
