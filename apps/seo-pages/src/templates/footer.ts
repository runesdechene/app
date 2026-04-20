export function renderFooter(): string {
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="footer-logo">
    <img
      src="https://runesdechene.com/cdn/shop/files/LOGO_ligne_marron.webp"
      alt="Runes de Chêne"
      loading="lazy"
    />
  </div>
  <p class="footer-text">
    Une marque née de l'amour pour l'Histoire, le patrimoine et la Nature.
    Des milliers d'explorateurs qui refusent l'oubli et documentent les lieux remarquables de France et d'ailleurs.
    Rejoignez-nous.
  </p>
  <nav class="footer-links">
    <a href="https://runesdechene.com">La Boutique</a>
    <a href="https://carte.runesdechene.com">Télécharger l'app</a>
    <a href="https://www.instagram.com/runesdechene" target="_blank" rel="noopener">Instagram</a>
  </nav>
  <p class="footer-copy">&copy; ${year} Runes de Chêne — Tous droits réservés. Marque et application développées par Lahoussaye EI.</p>
</footer>`;
}
