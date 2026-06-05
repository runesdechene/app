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
  descriptionByAuthor: boolean;
  authorName: string;
  authorAvatar: string | null;
  accessibility: string | null;
  contributions: Contribution[];
  placeName: string;
  placeSlug: string;
  shareTextTemplate: string;
}

export function renderPlaceContent(props: PlaceContentProps): string {
  const { description, descriptionByAuthor, authorName, authorAvatar, accessibility, contributions, placeName, placeSlug, shareTextTemplate } = props;
  const shareText = shareTextTemplate.replace('{name}', placeName);
  const shareUrl = `https://app.runesdechene.com/lieu/${placeSlug}`;
  const featured = contributions[0] ?? null;
  const remaining = contributions.slice(1);

  // Signature de l'auteur — uniquement quand la description affichée est bien
  // son texte (pas la synthèse Haiku), sinon l'attribution serait trompeuse.
  const showByline = descriptionByAuthor && !!authorName;
  const bylineHtml = showByline
    ? `<div class="description-byline">
    <div class="byline-avatar">${authorAvatar
      ? `<img src="${escapeAttr(authorAvatar)}" alt="${escapeAttr(authorName)}" loading="lazy" />`
      : escapeHtml(authorName.charAt(0).toUpperCase())}</div>
    <div class="byline-meta">
      <div class="byline-name">Décrit par ${escapeHtml(authorName)}</div>
      <div class="byline-role">Explorateur·rice</div>
    </div>
  </div>`
    : '';

  // La description peut provenir du texte brut saisi par l'utilisateur → on
  // échappe systématiquement le HTML (anti-XSS) avant de reconstruire les
  // paragraphes. Le sous-ensemble Haiku ne contient jamais de balises, donc
  // l'échappement est inoffensif pour lui.
  // Quand la signature suit, on resserre la marge basse de la description.
  const descStyle = showByline ? ' style="margin-bottom:20px"' : '';
  const descHtml = description
    ? `<div class="description"${descStyle}><p>${escapeHtml(description).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p></div>${bylineHtml}`
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
