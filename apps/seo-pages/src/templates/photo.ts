/**
 * QUOI     — la photo du lieu, en haut de la page : un voile sombre en haut et en bas pour que le
 *            logo et le bouton se lisent ; le logo d'Explore à gauche ; à droite, « Ouvrir
 *            Explore » (ordinateur, transparent) ou le partage (téléphone).
 * POURQUOI — maquettes 566:614 / 566:752 (Uriel, 11/10 : pas de lisière sous la photo, un bouton
 *            transparent, un dégradé en haut et en bas).
 */
import { aLaTaille, echapper } from '../lib/texte';

export function renderPhoto(input: {
  nom: string;
  photos: { url: string }[];
  texteDePartage: string;
  url: string;
}): string {
  const premiere = input.photos[0]?.url;
  const texte = input.texteDePartage.replaceAll('{name}', input.nom);
  return `<header class="photo">
  ${premiere ? `<img id="photo-du-lieu" src="${echapper(aLaTaille(premiere, 1440))}" alt="${echapper(input.nom)}" fetchpriority="high" />` : ''}
  <a class="logo" href="/bienvenue"><img src="/lieu/_static/logo-explore-clair.webp" alt="Runes de Chêne Explore" width="197" height="45" /></a>
  <a class="ouvrir" href="/bienvenue">Ouvrir Explore</a>
  <button class="partager" type="button" aria-label="Partager ce lieu" data-texte="${echapper(texte)}" data-url="${echapper(input.url)}">
    <img src="/lieu/_static/partager.svg" alt="" width="20" height="20" />
  </button>
</header>
<script>
  document.querySelector('.partager').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    const donnees = { title: document.title, text: b.dataset.texte, url: b.dataset.url };
    if (navigator.share) { try { await navigator.share(donnees); } catch {} return; }
    await navigator.clipboard?.writeText(b.dataset.url);
    b.setAttribute('aria-label', 'Lien copié');
  });
</script>`;
}
