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
      class="nav-share share-btn-js"
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

<div id="share-modal" class="share-modal-backdrop" role="dialog" aria-modal="true" hidden>
  <div class="share-modal" onclick="event.stopPropagation()">
    <h3>Partager ce lieu</h3>
    <textarea id="share-modal-text" readonly rows="4" class="share-modal-textarea"></textarea>
    <div class="share-modal-actions">
      <button id="share-modal-cancel" class="share-modal-cancel" type="button">Fermer</button>
      <button id="share-modal-copy" class="share-modal-copy" type="button">Copier dans le presse-papier</button>
    </div>
  </div>
</div>

<script>
(function() {
  var buttons = document.querySelectorAll('.share-btn-js');
  if (!buttons.length) return;

  var modal = document.getElementById('share-modal');
  var modalTextarea = document.getElementById('share-modal-text');
  var modalCopy = document.getElementById('share-modal-copy');
  var modalCancel = document.getElementById('share-modal-cancel');

  var isMobile = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  function openModal(fullText) {
    if (!modal || !modalTextarea) return;
    modalTextarea.value = fullText;
    modal.removeAttribute('hidden');
    setTimeout(function() { modalTextarea.select(); }, 50);
  }

  function closeModal() {
    if (!modal || !modalCopy) return;
    modal.setAttribute('hidden', '');
    modalCopy.textContent = 'Copier dans le presse-papier';
  }

  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeModal();
    });
  }

  if (modalCancel) {
    modalCancel.addEventListener('click', closeModal);
  }

  if (modalCopy) {
    modalCopy.addEventListener('click', async function() {
      if (!modalTextarea) return;
      var text = modalTextarea.value;
      try {
        await navigator.clipboard.writeText(text);
        modalCopy.textContent = '✓ Copié';
        setTimeout(closeModal, 1500);
      } catch (err) {
        // clipboard non disponible — textarea déjà sélectionnée, user peut Ctrl+C
      }
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal && !modal.hasAttribute('hidden')) closeModal();
  });

  buttons.forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var title = btn.getAttribute('data-share-title') || '';
      var text = btn.getAttribute('data-share-text') || '';
      var url = btn.getAttribute('data-share-url') || '';
      var fullText = text + '\n' + url;

      try {
        if (navigator.share && isMobile) {
          await navigator.share({ title: title, text: text, url: url });
        } else {
          openModal(fullText);
        }
      } catch (err) {
        if (err && err.name !== 'AbortError') {
          openModal(fullText);
        }
      }
    });
  });
})();
</script>`
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
