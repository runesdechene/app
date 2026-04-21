interface RenderHeaderInput {
  placeName: string
  placeSlug: string
  shareTextTemplate: string
}

export function renderHeader({ placeName, placeSlug, shareTextTemplate }: RenderHeaderInput): string {
  const shareText = shareTextTemplate.replace('{name}', placeName)
  const shareUrl = `https://carte.runesdechene.com/lieu/${placeSlug}`

  return `<nav class="nav">
  <a href="https://runesdechene.com" class="nav-logo">
    <img
      src="https://runesdechene.com/cdn/shop/files/LOGO_ligne_marron.webp"
      alt="Runes de Chêne"
      loading="eager"
    />
  </a>
  <div class="nav-actions">
    <button
      class="nav-share"
      type="button"
      data-share-title="${escapeAttr(placeName)}"
      data-share-text="${escapeAttr(shareText)}"
      data-share-url="${escapeAttr(shareUrl)}"
      aria-label="Partager ce lieu"
      title="Partager"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
        <circle cx="18" cy="5" r="3"/>
        <circle cx="6" cy="12" r="3"/>
        <circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
    </button>
    <a href="https://carte.runesdechene.com" class="nav-cta">Ouvrir l'application</a>
  </div>
</nav>

<div id="share-toast" class="share-toast" aria-live="polite"></div>

<script>
(function() {
  var btn = document.querySelector('.nav-share');
  var toast = document.getElementById('share-toast');
  if (!btn || !toast) return;

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('visible');
    setTimeout(function() { toast.classList.remove('visible'); }, 2200);
  }

  btn.addEventListener('click', async function() {
    var title = btn.getAttribute('data-share-title') || '';
    var text = btn.getAttribute('data-share-text') || '';
    var url = btn.getAttribute('data-share-url') || '';

    try {
      if (navigator.share) {
        await navigator.share({ title: title, text: text, url: url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        showToast('Lien copié ✓');
      } else {
        showToast(url);
      }
    } catch (err) {
      if (err && err.name !== 'AbortError') {
        showToast('Échec du partage');
      }
    }
  });
})();
</script>`
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
