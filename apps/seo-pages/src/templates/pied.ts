/**
 * QUOI     — le bas de page de la marque, le même que celui de la vitrine (Figma 549:828) : la
 *            forêt immersive du site, puis la marque, sa devise et ses liens.
 */
const BOUTIQUE = 'https://runesdechene.com';

export function renderPied(): string {
  return `<footer class="pied">
  <div class="foret" aria-hidden="true"></div>
  <div class="creme">
    <p class="reseaux">
      <a href="https://facebook.com/runesdechene" target="_blank" rel="noopener">Facebook</a>
      <a href="https://instagram.com/runesdechene" target="_blank" rel="noopener">Instagram</a>
    </p>
    <div class="haut">
      <div class="marque">
        <img class="logotype" src="/lieu/_static/logotype.webp" alt="Runes de Chêne" width="216" height="39" loading="lazy" />
        <p><strong>Runes de Chêne</strong> est une marque française qui fait porter l’Histoire. <strong>Explore</strong> est sa carte des lieux anciens et oubliés, offerte à tous.</p>
        <p class="devise">Apprenez. Incarnez. Explorez !</p>
      </div>
      <nav class="liens" aria-label="Runes de Chêne">
        <div>
          <h2>Aller plus loin</h2>
          <a href="${BOUTIQUE}/pages/notre-mission">Notre mission</a>
          <a href="/mouvement">Le Mouvement</a>
          <a href="${BOUTIQUE}">La boutique</a>
        </div>
        <div>
          <h2>Explore</h2>
          <a href="/bienvenue/carte">La carte</a>
          <a href="/bienvenue/preambule">Commencer mon périple</a>
          <a href="/bienvenue/email">Se connecter</a>
        </div>
      </nav>
    </div>
    <p class="bas">© ${new Date().getFullYear()} Runes de Chêne</p>
  </div>
</footer>`;
}
