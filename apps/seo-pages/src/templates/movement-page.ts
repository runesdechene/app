// apps/seo-pages/src/templates/movement-page.ts
// Page "Le Mouvement" : manifeste epique (hero image landing -> degrade parchemin) + mur communautaire.
// HTML statique autonome (charge ses propres polices de marque). Design : heritage / conquete.
import type { WallPhoto } from '../lib/movement';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Copie de 1re intention (a affiner editorialement, ligne bonapartiste). Concrete, pas un placeholder.
const MANIFESTO_KICKER = 'Runes de Chêne · La Carte';
const MANIFESTO_TITLE_TOP = 'Le';
const MANIFESTO_TITLE_BOTTOM = 'Mouvement';
const MANIFESTO_LEAD = "Une marque, une carte, et celles et ceux qui partent à l'aventure.";
const MANIFESTO_BODY = "Runes de Chêne n'est pas qu'une boutique : c'est une communauté en marche. Chaque pièce portée devient une histoire, chaque lieu exploré sur La Carte devient une conquête. Ce mur rassemble celles et ceux qui font vivre le Mouvement — leur terrain, leur style, leur élan.";

function photoCard(p: WallPhoto, index: number): string {
  const credit = p.submitterInstagram
    ? `@${escapeHtml(p.submitterInstagram.replace(/^@/, ''))}`
    : (p.submitterName ? escapeHtml(p.submitterName) : 'Anonyme');
  const product = (p.productHandle && p.productTitle)
    ? `<a class="mv-card__product" href="https://runesdechene.com/products/${escapeHtml(p.productHandle)}">${escapeHtml(p.productTitle)}<span class="mv-card__arrow" aria-hidden="true">→</span></a>`
    : '';
  // animation-delay echelonne, plafonne pour ne pas trop attendre sur les grands murs
  const delay = Math.min(index, 12) * 60;
  return `<figure class="mv-card" data-mv-card style="--d:${delay}ms">
  <div class="mv-card__frame">
    <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.submitterName || 'Membre du Mouvement Runes de Chêne')}" loading="lazy" data-mv-img />
    <figcaption class="mv-card__cap">
      <span class="mv-card__credit">${credit}</span>
      ${product}
    </figcaption>
  </div>
</figure>`;
}

export function renderMovementPage(photos: WallPhoto[], bgUrl: string | null = null): string {
  const grid = photos.map((p, i) => photoCard(p, i)).join('\n');
  const urls = JSON.stringify(photos.map(p => p.imageUrl)).replace(/</g, '\\u003c');
  const count = photos.length;
  const countLabel = count > 0
    ? `${count} ${count > 1 ? 'visages du Mouvement' : 'visage du Mouvement'}`
    : 'Le Mouvement se rassemble';
  // Image de fond (landing) — injectee en variable CSS si presente et valide
  const safeBg = bgUrl && /^https:\/\/[^\s"'()\\]+$/.test(bgUrl) ? bgUrl : null;
  const bgVar = safeBg ? `<style>:root{--mv-bg:url("${safeBg}");}</style>` : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Le Mouvement — Runes de Chêne</title>
<meta name="description" content="${escapeHtml(MANIFESTO_LEAD)}" />
<link rel="canonical" href="https://app.runesdechene.com/mouvement" />
<meta property="og:title" content="Le Mouvement — Runes de Chêne" />
<meta property="og:description" content="${escapeHtml(MANIFESTO_LEAD)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://app.runesdechene.com/mouvement" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cabin+Condensed:wght@500;600;700&family=Cabin:ital,wght@0,400;0,500;0,600;1,400&display=swap" />
<link rel="preconnect" href="https://ukpapqssgsxirsgmcvof.supabase.co" />
<style>
  :root {
    --parchment:#f1e3cc; --parchment-2:#e7d4b6; --cream:#f6ecd8;
    --ink:#2a1d12; --ink-soft:#5d4634;
    --night:#190f08; --night-2:#2a160f;
    --oxblood:#7c2d2d; --oxblood-deep:#5b1d1d;
    --bronze:#c49a5b; --bronze-soft:#d9bd8a;
    --maxw:1180px; --pad-x:clamp(18px,5vw,64px);
  }
  * { box-sizing:border-box; }
  html { scroll-behavior:smooth; }
  body {
    margin:0; background:var(--parchment); color:var(--ink);
    font-family:'Cabin',system-ui,sans-serif; font-size:18px; line-height:1.6;
    -webkit-font-smoothing:antialiased; overflow-x:hidden;
  }
  /* Grain global */
  body::after {
    content:""; position:fixed; inset:0; pointer-events:none; z-index:9999; opacity:.05;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }
  .mv-kicker { font-family:'Cabin Condensed',sans-serif; text-transform:uppercase; letter-spacing:.42em;
    font-weight:600; font-size:13px; }

  /* ====== HERO : image landing -> degrade parchemin ====== */
  .mv-hero {
    position:relative; min-height:100svh; display:flex; flex-direction:column;
    align-items:center; justify-content:center; text-align:center; padding:8vh 24px 18vh;
    color:var(--cream); overflow:hidden; isolation:isolate;
    background-color:var(--night);
    background-image:
      linear-gradient(180deg,
        rgba(18,11,5,.58) 0%, rgba(18,11,5,.30) 36%, rgba(18,11,5,.40) 64%,
        rgba(241,227,204,0) 85%, var(--parchment) 100%),
      var(--mv-bg, none);
    background-size:cover; background-position:center top; background-repeat:no-repeat;
  }
  /* courbes topographiques discretes */
  .mv-hero::before {
    content:""; position:absolute; inset:-10%; z-index:-1; opacity:.32;
    background-image:
      repeating-radial-gradient(circle at 22% 18%, transparent 0 38px, rgba(196,154,91,.07) 38px 39px),
      repeating-radial-gradient(circle at 82% 84%, transparent 0 52px, rgba(196,154,91,.06) 52px 53px);
    -webkit-mask-image:radial-gradient(120% 110% at 50% 38%, #000 38%, transparent 78%);
            mask-image:radial-gradient(120% 110% at 50% 38%, #000 38%, transparent 78%);
  }
  /* vignette laterale/haute — masquee en bas pour preserver le fondu parchemin */
  .mv-hero::after {
    content:""; position:absolute; inset:0; z-index:-1; pointer-events:none;
    background:radial-gradient(130% 80% at 50% 26%, transparent 56%, rgba(12,7,3,.55) 100%);
    -webkit-mask-image:linear-gradient(180deg,#000 0,#000 58%,transparent 86%);
            mask-image:linear-gradient(180deg,#000 0,#000 58%,transparent 86%);
  }
  .mv-hero__inner { max-width:880px; }
  .mv-hero .mv-kicker { color:var(--bronze); margin:0 0 26px;
    opacity:0; animation:rise .9s .1s cubic-bezier(.2,.7,.2,1) forwards; }
  .mv-hero__rule { width:54px; height:2px; margin:0 auto 26px; background:var(--bronze);
    opacity:0; animation:grow .8s .15s cubic-bezier(.2,.7,.2,1) forwards; transform-origin:center; }
  .mv-title { font-family:'Bebas Neue',Impact,sans-serif; line-height:.84; margin:0;
    letter-spacing:.02em; text-shadow:0 2px 40px rgba(0,0,0,.5); }
  .mv-title span { display:block; }
  .mv-title .t1 { font-size:clamp(30px,5vw,56px); color:var(--bronze-soft); letter-spacing:.18em;
    opacity:0; animation:rise .9s .25s cubic-bezier(.2,.7,.2,1) forwards; }
  .mv-title .t2 { font-size:clamp(58px,11vw,138px); color:var(--cream);
    opacity:0; animation:rise 1s .38s cubic-bezier(.2,.7,.2,1) forwards; }
  .mv-hero__lead { font-family:'Cabin Condensed',sans-serif; font-weight:600;
    font-size:clamp(18px,2.4vw,25px); color:var(--bronze-soft); margin:22px auto 18px; max-width:620px;
    opacity:0; animation:rise .9s .55s cubic-bezier(.2,.7,.2,1) forwards; text-shadow:0 1px 16px rgba(0,0,0,.5); }
  .mv-hero__body { color:var(--cream); font-size:clamp(15px,1.6vw,18px);
    max-width:600px; margin:0 auto; opacity:0; animation:rise .9s .7s cubic-bezier(.2,.7,.2,1) forwards;
    text-shadow:0 1px 16px rgba(0,0,0,.55); }
  .mv-scroll { position:absolute; bottom:6vh; left:50%; transform:translateX(-50%);
    font-family:'Cabin Condensed',sans-serif; text-transform:uppercase; letter-spacing:.3em; font-size:11px;
    color:var(--ink-soft); opacity:0; animation:fade 1s 1.1s forwards; }
  .mv-scroll span { display:block; width:1px; height:30px; margin:9px auto 0;
    background:linear-gradient(var(--ink-soft),transparent); animation:bob 1.8s ease-in-out infinite; }

  /* ====== GALERIE parchemin ====== */
  .mv-gallery { position:relative; padding:clamp(40px,6vw,80px) var(--pad-x) 40px; }
  .mv-gallery__head { max-width:var(--maxw); margin:0 auto clamp(32px,5vw,56px);
    display:flex; align-items:flex-end; justify-content:space-between; gap:24px; flex-wrap:wrap;
    border-bottom:1px solid rgba(124,45,45,.22); padding-bottom:20px; }
  .mv-gallery__title { font-family:'Bebas Neue',sans-serif; font-size:clamp(30px,5vw,54px);
    color:var(--oxblood); margin:0; letter-spacing:.02em; line-height:1; }
  .mv-gallery__count { font-family:'Cabin Condensed',sans-serif; text-transform:uppercase;
    letter-spacing:.18em; font-size:13px; color:var(--ink-soft); white-space:nowrap; }

  .mv-grid { max-width:var(--maxw); margin:0 auto;
    column-count:3; column-gap:16px; }
  @media (max-width:900px){ .mv-grid{ column-count:2; } }
  @media (max-width:560px){ .mv-grid{ column-count:1; max-width:440px; } }

  .mv-card { break-inside:avoid; margin:0 0 16px; }
  .mv-card[data-mv-card]{ opacity:0; transform:translateY(26px); }
  .mv-card.in { opacity:1; transform:none;
    transition:opacity .7s var(--d) cubic-bezier(.2,.7,.2,1), transform .7s var(--d) cubic-bezier(.2,.7,.2,1); }
  .mv-card__frame { position:relative; overflow:hidden; border-radius:3px; background:var(--parchment-2);
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset, 0 10px 30px -12px rgba(42,22,12,.5);
    border:1px solid rgba(124,45,45,.12); }
  .mv-card__frame::after { content:""; position:absolute; inset:0; pointer-events:none;
    box-shadow:inset 0 0 0 6px var(--cream), inset 0 0 0 7px rgba(124,45,45,.18); border-radius:3px; }
  .mv-card img { display:block; width:100%; height:auto; cursor:zoom-in;
    transition:transform .9s cubic-bezier(.2,.7,.2,1), filter .6s; filter:saturate(.96) contrast(1.02); }
  .mv-card:hover img { transform:scale(1.05); filter:saturate(1.05) contrast(1.04); }
  .mv-card__cap { position:absolute; left:0; right:0; bottom:0; padding:34px 16px 14px;
    display:flex; align-items:flex-end; justify-content:space-between; gap:10px;
    background:linear-gradient(transparent, rgba(20,11,5,.82)); color:var(--cream);
    opacity:0; transform:translateY(8px); transition:opacity .4s, transform .4s; }
  .mv-card:hover .mv-card__cap, .mv-card:focus-within .mv-card__cap { opacity:1; transform:none; }
  .mv-card__credit { font-family:'Cabin Condensed',sans-serif; font-weight:600;
    text-transform:uppercase; letter-spacing:.1em; font-size:13px; }
  .mv-card__product { color:var(--bronze-soft); text-decoration:none; font-weight:600; font-size:13px;
    display:inline-flex; align-items:center; gap:5px; border-bottom:1px solid transparent; }
  .mv-card__product:hover { border-bottom-color:var(--bronze-soft); }
  .mv-card__arrow { transition:transform .3s; }
  .mv-card__product:hover .mv-card__arrow { transform:translateX(3px); }

  .mv-empty { max-width:520px; margin:0 auto; text-align:center; padding:6vh 24px 8vh; color:var(--ink-soft);
    font-family:'Cabin Condensed',sans-serif; font-size:20px; }

  /* ====== CTA : carte contenue (largeur photos), bord arrondi, image en fond ====== */
  .mv-cta-wrap { max-width:var(--maxw); margin:clamp(36px,6vw,72px) auto 0; padding:0 var(--pad-x); }
  .mv-cta { position:relative; padding:clamp(54px,9vw,108px) 24px; border-radius:22px;
    text-align:center; color:var(--cream); overflow:hidden; isolation:isolate;
    background-color:var(--oxblood-deep);
    background-image:
      linear-gradient(160deg, rgba(124,45,45,.84) 0%, rgba(91,29,29,.92) 100%),
      var(--mv-bg, none);
    background-size:cover; background-position:center;
    box-shadow:0 30px 60px -28px rgba(42,22,12,.6); border:1px solid rgba(196,154,91,.28); }
  .mv-cta::before { content:""; position:absolute; inset:0; z-index:-1; opacity:.5;
    background-image:repeating-radial-gradient(circle at 50% 120%, transparent 0 46px, rgba(196,154,91,.08) 46px 47px); }
  .mv-cta h2 { font-family:'Bebas Neue',sans-serif; font-size:clamp(34px,5.5vw,64px); margin:0 0 8px; letter-spacing:.03em;
    text-shadow:0 2px 24px rgba(0,0,0,.4); }
  .mv-cta p { color:var(--cream); margin:0 0 30px; text-shadow:0 1px 14px rgba(0,0,0,.45); }
  .mv-btn { display:inline-block; font-family:'Cabin Condensed',sans-serif; text-transform:uppercase;
    letter-spacing:.18em; font-weight:700; font-size:15px; color:var(--ink); background:var(--bronze);
    padding:16px 38px; border-radius:2px; text-decoration:none;
    box-shadow:0 14px 30px -10px rgba(0,0,0,.5); transition:transform .3s, box-shadow .3s, background .3s; }
  .mv-btn:hover { transform:translateY(-3px); background:var(--bronze-soft);
    box-shadow:0 20px 40px -12px rgba(0,0,0,.6); }
  .mv-foot { text-align:center; padding:30px 24px 38px; font-family:'Cabin Condensed',sans-serif;
    text-transform:uppercase; letter-spacing:.22em; font-size:11px; color:var(--ink-soft);
    background:var(--parchment); }

  /* ====== LIGHTBOX ====== */
  .mv-lb { position:fixed; inset:0; z-index:1000; display:none; align-items:center; justify-content:center;
    background:rgba(16,9,4,.94); padding:5vw; cursor:zoom-out; }
  .mv-lb.open { display:flex; animation:fade .25s; }
  .mv-lb img { max-width:92vw; max-height:90vh; border:7px solid var(--cream);
    box-shadow:0 30px 80px -20px rgba(0,0,0,.8); }

  @keyframes rise { from{opacity:0; transform:translateY(26px);} to{opacity:1; transform:none;} }
  @keyframes grow { from{opacity:0; transform:scaleX(0);} to{opacity:1; transform:scaleX(1);} }
  @keyframes fade { to{opacity:1;} }
  @keyframes bob { 0%,100%{transform:translateY(0);opacity:.9;} 50%{transform:translateY(6px);opacity:.4;} }

  @media (prefers-reduced-motion: reduce) {
    *{ animation:none !important; }
    .mv-card[data-mv-card]{ opacity:1; transform:none; }
    html{ scroll-behavior:auto; }
  }
</style>
${bgVar}
</head>
<body>
  <header class="mv-hero">
    <div class="mv-hero__inner">
      <p class="mv-kicker">${MANIFESTO_KICKER}</p>
      <div class="mv-hero__rule"></div>
      <h1 class="mv-title"><span class="t1">${MANIFESTO_TITLE_TOP}</span><span class="t2">${MANIFESTO_TITLE_BOTTOM}</span></h1>
      <p class="mv-hero__lead">${escapeHtml(MANIFESTO_LEAD)}</p>
      <p class="mv-hero__body">${escapeHtml(MANIFESTO_BODY)}</p>
    </div>
    <div class="mv-scroll">Découvrir<span></span></div>
  </header>

  <main class="mv-gallery" id="mur">
    <div class="mv-gallery__head">
      <h2 class="mv-gallery__title">Ils portent le Mouvement</h2>
      <span class="mv-gallery__count">${countLabel}</span>
    </div>
    ${count > 0
      ? `<div class="mv-grid">\n${grid}\n</div>`
      : `<p class="mv-empty">Les premiers visages du Mouvement arrivent bientôt. Contribue, et rejoins le mur.</p>`}
  </main>

  <div class="mv-cta-wrap">
    <section class="mv-cta">
      <h2>Rejoins le Mouvement</h2>
      <p>Pars à l'aventure sur La Carte. Gratuit.</p>
      <a class="mv-btn" href="https://app.runesdechene.com">Rejoindre La Carte</a>
    </section>
  </div>
  <footer class="mv-foot">Runes de Chêne — Lahoussaye EI</footer>

  <div class="mv-lb" data-mv-lb><img src="" alt="" data-mv-lb-img /></div>

  <script>
  (function(){
    var urls = ${urls};
    var cards = document.querySelectorAll('[data-mv-card]');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px' });
      cards.forEach(function(c){ io.observe(c); });
    } else {
      cards.forEach(function(c){ c.classList.add('in'); });
    }
    var lb = document.querySelector('[data-mv-lb]');
    var lbImg = lb && lb.querySelector('[data-mv-lb-img]');
    document.querySelectorAll('[data-mv-img]').forEach(function(img, i){
      img.addEventListener('click', function(){ if(lbImg){ lbImg.src = urls[i]; lb.classList.add('open'); } });
    });
    if (lb) lb.addEventListener('click', function(){ lb.classList.remove('open'); if(lbImg) lbImg.src=''; });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape' && lb){ lb.classList.remove('open'); } });
  })();
  </script>
</body>
</html>`;
}
