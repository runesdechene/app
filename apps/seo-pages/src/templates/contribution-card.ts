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
