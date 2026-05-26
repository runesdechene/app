// apps/seo-pages/src/templates/movement-page.ts
import type { WallPhoto } from '../lib/movement';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Copie de 1re intention (a affiner editorialement, ligne bonapartiste). Volontairement concrete, pas un placeholder.
const MANIFESTO_TITLE = 'Le Mouvement';
const MANIFESTO_LEAD = "Une marque, une carte, et celles et ceux qui partent a l'aventure.";
const MANIFESTO_BODY = "Runes de Chene n'est pas qu'une boutique : c'est une communaute en marche. Chaque piece portee devient une histoire, chaque lieu explore sur La Carte devient une conquete. Ce mur rassemble celles et ceux qui font vivre le Mouvement — leurs photos, leur terrain, leur style. Rejoins-les.";

function photoCard(p: WallPhoto): string {
  const credit = p.submitterInstagram
    ? `@${escapeHtml(p.submitterInstagram.replace(/^@/, ''))}`
    : (p.submitterName ? escapeHtml(p.submitterName) : '');
  const product = (p.productHandle && p.productTitle)
    ? `<a class="mv-card-product" href="https://runesdechene.com/products/${escapeHtml(p.productHandle)}">${escapeHtml(p.productTitle)}</a>`
    : '';
  return `<figure class="mv-card">
  <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.submitterName || 'Communaute Runes de Chene')}" loading="lazy" data-mv-img />
  <figcaption>${credit ? `<span class="mv-card-credit">${credit}</span>` : ''}${product}</figcaption>
</figure>`;
}

export function renderMovementPage(photos: WallPhoto[]): string {
  const grid = photos.map(photoCard).join('\n');
  const urls = JSON.stringify(photos.map(p => p.imageUrl)).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${MANIFESTO_TITLE} — Runes de Chêne</title>
<meta name="description" content="${escapeHtml(MANIFESTO_LEAD)}" />
<link rel="canonical" href="https://app.runesdechene.com/mouvement" />
<meta property="og:title" content="${MANIFESTO_TITLE} — Runes de Chêne" />
<meta property="og:description" content="${escapeHtml(MANIFESTO_LEAD)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://app.runesdechene.com/mouvement" />
<link rel="preconnect" href="https://ukpapqssgsxirsgmcvof.supabase.co" />
<style>
  :root { --parchemin:#f7ede1; --encre:#4A3728; --accent:#833434; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--parchemin); color:var(--encre); font-family:'Cabin',system-ui,sans-serif; }
  .mv-hero { padding:18vh 24px 8vh; text-align:center; max-width:820px; margin:0 auto; }
  .mv-hero h1 { font-family:'Bebas Neue',Impact,sans-serif; font-size:clamp(48px,12vw,120px); margin:0 0 8px; letter-spacing:2px; }
  .mv-hero .lead { font-size:clamp(18px,3vw,26px); color:var(--accent); font-weight:600; margin:0 0 18px; }
  .mv-hero p { font-size:18px; line-height:1.6; }
  .mv-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:6px; padding:24px; }
  .mv-card { margin:0; position:relative; overflow:hidden; border-radius:4px; background:#E8D5BE; }
  .mv-card img { width:100%; height:100%; aspect-ratio:3/4; object-fit:cover; display:block; cursor:pointer; }
  .mv-card figcaption { position:absolute; left:0; right:0; bottom:0; padding:8px 10px; display:flex; justify-content:space-between; gap:8px; font-size:12px; color:#fff; background:linear-gradient(transparent,rgba(0,0,0,.7)); }
  .mv-card-product { color:#fff; text-decoration:underline; }
  .mv-empty { text-align:center; padding:8vh 24px; color:#7D5A3C; }
  .mv-cta { display:block; text-align:center; padding:6vh 24px 10vh; }
  .mv-cta a { display:inline-block; background:var(--accent); color:#fff; padding:14px 28px; border-radius:8px; text-decoration:none; font-weight:700; }
  .mv-lightbox { position:fixed; inset:0; background:rgba(0,0,0,.9); display:none; align-items:center; justify-content:center; z-index:99; }
  .mv-lightbox.open { display:flex; }
  .mv-lightbox img { max-width:92vw; max-height:88vh; }
</style>
</head>
<body>
<section class="mv-hero">
  <h1>${MANIFESTO_TITLE}</h1>
  <p class="lead">${escapeHtml(MANIFESTO_LEAD)}</p>
  <p>${escapeHtml(MANIFESTO_BODY)}</p>
</section>
${photos.length > 0
  ? `<section class="mv-grid" data-mv-grid>\n${grid}\n</section>`
  : `<div class="mv-empty">Les premieres photos du Mouvement arrivent bientot.</div>`}
<div class="mv-cta"><a href="https://app.runesdechene.com">Rejoindre La Carte</a></div>
<div class="mv-lightbox" data-mv-lightbox><img src="" alt="" data-mv-lightbox-img /></div>
<script>
(function(){
  var urls = ${urls};
  var lb = document.querySelector('[data-mv-lightbox]');
  var lbImg = lb && lb.querySelector('[data-mv-lightbox-img]');
  document.querySelectorAll('[data-mv-img]').forEach(function(img, i){
    img.addEventListener('click', function(){ if(lbImg){ lbImg.src = urls[i]; lb.classList.add('open'); } });
  });
  if (lb) lb.addEventListener('click', function(){ lb.classList.remove('open'); });
})();
</script>
</body>
</html>`;
}
