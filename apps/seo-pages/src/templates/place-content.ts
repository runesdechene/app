import type { Contribution } from '../lib/places';
import { renderContributionCard } from './contribution-card';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

interface PlaceContentProps {
  description: string | null;
  accessibility: string | null;
  contributions: Contribution[];
  placeName: string;
  placeSlug: string;
  shareTextTemplate: string;
}

export function renderPlaceContent(props: PlaceContentProps): string {
  const { description, accessibility, contributions, placeName, placeSlug, shareTextTemplate } = props;
  const shareText = shareTextTemplate.replace('{name}', placeName);
  const shareUrl = `https://app.runesdechene.com/lieu/${placeSlug}`;
  const featured = contributions[0] ?? null;
  const remaining = contributions.slice(1);

  // La description peut provenir du texte brut saisi par l'utilisateur → on
  // échappe systématiquement le HTML (anti-XSS) avant de reconstruire les
  // paragraphes. Le sous-ensemble Haiku ne contient jamais de balises, donc
  // l'échappement est inoffensif pour lui.
  const descHtml = description
    ? `<div class="description"><p>${escapeHtml(description).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p></div>`
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
  <a href="https://app.runesdechene.com" class="contribute-btn">Ajouter ma contribution</a>
  <button
    class="share-cta share-btn-js"
    type="button"
    data-share-title="${escapeAttr(placeName)}"
    data-share-text="${escapeAttr(shareText)}"
    data-share-url="${escapeAttr(shareUrl)}"
    aria-label="Partager ce lieu"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" style="vertical-align: middle; margin-right: 8px;">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
    Partager ce lieu
  </button>
</div>`;
}
