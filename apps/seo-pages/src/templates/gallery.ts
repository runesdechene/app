import type { PlaceTag } from '../lib/places';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface GalleryProps {
  images: Array<{ id: string; url: string; thumb?: string }>;
  title: string;
  address: string;
  authorName: string;
  primaryTag: PlaceTag | null;
  placeCount: number;
  breadcrumbTag: string;
}

export function renderGallery(props: GalleryProps): string {
  const { images: rawImages, title, address, authorName, primaryTag, placeCount, breadcrumbTag } = props;
  const images = rawImages ?? [];
  const mainImage = images[0] ?? null;

  const heroImg = mainImage
    ? `<img src="${escapeHtml(mainImage.url)}" alt="${escapeHtml(title)}" loading="eager" fetchpriority="high" class="hero-img" data-gallery-main />`
    : `<div class="hero-placeholder"><span>Aucune photo</span></div>`;

  const fullscreenBtn = mainImage
    ? `<button class="hero-fullscreen" data-gallery-fullscreen aria-label="Voir en plein écran">\u26F6</button>`
    : '';

  const tagHtml = primaryTag ? (() => {
    const iconHtml = primaryTag.icon
      ? `<span class="hero-tag-icon" style="background-color: ${escapeHtml(primaryTag.color)}; -webkit-mask-image: url(${escapeHtml(primaryTag.icon)}); mask-image: url(${escapeHtml(primaryTag.icon)});"></span>`
      : '';
    return `<div class="hero-tag" style="background: ${escapeHtml(primaryTag.background)}; color: ${escapeHtml(primaryTag.color)};">${iconHtml}${escapeHtml(primaryTag.title)}</div>`;
  })() : '';

  const addressHtml = address ? `<p class="hero-address">${escapeHtml(address)}</p>` : '';
  const creditHtml = authorName ? `<p class="hero-credit">Photo par ${escapeHtml(authorName)}</p>` : '';

  const breadcrumbTagEncoded = encodeURIComponent(breadcrumbTag.toLowerCase());

  const thumbsHtml = images.length > 1
    ? `<div class="thumbs" data-gallery-thumbs>
${images.map((img, i) => `  <div class="thumb${i === 0 ? ' active' : ''}" data-gallery-thumb="${i}">
    <img src="${escapeHtml(img.thumb || img.url)}" alt="${escapeHtml(title)} — photo ${i + 1}" loading="lazy" />
  </div>`).join('\n')}
</div>`
    : '';

  const urls = JSON.stringify(images.map(img => img.url));

  return `<!-- HERO -->
<section class="hero" data-gallery>
  ${heroImg}
  <div class="hero-overlay"></div>
  ${fullscreenBtn}
  <div class="hero-content">
    <div class="hero-breadcrumb">
      <a href="https://runesdechene.com">Runes de Ch\u00EAne</a>
      <span class="sep">\u203A</span>
      <a href="https://carte.runesdechene.com/lieu?tag=${breadcrumbTagEncoded}">${escapeHtml(breadcrumbTag)}</a>
      <span class="sep">\u203A</span>
      ${escapeHtml(title)}
    </div>
    ${tagHtml}
    <h1 class="hero-title">${escapeHtml(title)}</h1>
    ${addressHtml}
    ${creditHtml}
  </div>
</section>

${thumbsHtml}

<!-- GALLERY CTA -->
<a href="https://carte.runesdechene.com" class="gallery-cta">
  <img src="/app-icon.png" alt="Runes de Ch\u00EAne" class="gallery-cta-logo" loading="lazy" />
  <span>
    D\u00E9couvrir ce lieu sur l'application
    <span class="gallery-cta-sub">\u00C9co-tourisme d'aventure \u00B7 ${placeCount}+ lieux \u00E0 explorer \u00B7 Gratuit</span>
  </span>
</a>

<!-- LIGHTBOX -->
<div class="lightbox" data-lightbox>
  <button class="lightbox-close" data-lightbox-close>\u2715</button>
  <button class="lightbox-nav lightbox-prev" data-lightbox-prev>\u2039</button>
  <img src="" alt="" data-lightbox-img />
  <button class="lightbox-nav lightbox-next" data-lightbox-next>\u203A</button>
</div>

<!-- INTERACTION SCRIPT -->
<script>
(function() {
  var urls = ${urls};
  var gallery = document.querySelector('[data-gallery]');
  var thumbsContainer = document.querySelector('[data-gallery-thumbs]');
  var lightbox = document.querySelector('[data-lightbox]');
  var currentIndex = 0;

  function goTo(index) {
    if (index < 0) index = urls.length - 1;
    if (index >= urls.length) index = 0;
    currentIndex = index;
    var mainImg = gallery && gallery.querySelector('[data-gallery-main]');
    if (mainImg) mainImg.src = urls[index];
    if (thumbsContainer) {
      thumbsContainer.querySelectorAll('[data-gallery-thumb]').forEach(function(t, i) {
        t.classList.toggle('active', i === index);
        if (i === index) t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });
    }
    var lbImg = lightbox && lightbox.querySelector('[data-lightbox-img]');
    if (lbImg) lbImg.src = urls[index];
  }

  if (thumbsContainer) {
    thumbsContainer.querySelectorAll('[data-gallery-thumb]').forEach(function(thumb, i) {
      thumb.addEventListener('click', function() { goTo(i); });
    });
  }

  if (gallery && urls.length > 1) {
    var startX = 0, startY = 0;
    gallery.addEventListener('touchstart', function(e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    gallery.addEventListener('touchend', function(e) {
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goTo(currentIndex + 1);
        else goTo(currentIndex - 1);
      }
    }, { passive: true });
  }

  var fsBtn = document.querySelector('[data-gallery-fullscreen]');
  var lbImg = lightbox && lightbox.querySelector('[data-lightbox-img]');
  var lbClose = lightbox && lightbox.querySelector('[data-lightbox-close]');

  function openLightbox() {
    if (!lightbox || !lbImg) return;
    lbImg.src = urls[currentIndex];
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    if (lightbox) lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (fsBtn) fsBtn.addEventListener('click', openLightbox);
  var mainImg = gallery && gallery.querySelector('[data-gallery-main]');
  if (mainImg) mainImg.addEventListener('dblclick', openLightbox);
  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lightbox) lightbox.addEventListener('click', function(e) { if (e.target === lightbox) closeLightbox(); });

  var lbPrev = lightbox && lightbox.querySelector('[data-lightbox-prev]');
  var lbNext = lightbox && lightbox.querySelector('[data-lightbox-next]');
  if (lbPrev) lbPrev.addEventListener('click', function(e) { e.stopPropagation(); goTo(currentIndex - 1); });
  if (lbNext) lbNext.addEventListener('click', function(e) { e.stopPropagation(); goTo(currentIndex + 1); });

  document.addEventListener('keydown', function(e) {
    if (!lightbox || !lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
    if (e.key === 'ArrowRight') goTo(currentIndex + 1);
  });
})();
</script>`;
}
