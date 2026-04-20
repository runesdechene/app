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
