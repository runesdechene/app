/**
 * QUOI     — fait glisser le détail ouvert hors du tiroir ; la promesse se tient quand il est parti.
 * POURQUOI — fermer un détail le retire de la page d'un coup : React ne sait pas animer ce qui
 *            disparaît. On anime donc AVANT de naviguer (Uriel, 28/09 : « qu'il se replie »),
 *            avec l'animation du navigateur (Element.animate), aux jetons de mouvement.
 * ATTENTION — rien à animer (pas de détail, animations réduites, navigateur sans animate) : la
 *            promesse se tient tout de suite. Le retour du navigateur, lui, ne passe pas par ici.
 *            Ensuite, l'écran de l'onglet revient en glissant (Shell.module.css : un seul
 *            tiroir à la fois).
 */
export async function replierDetail(): Promise<void> {
  const detail = document.querySelector<HTMLElement>('[data-detail]')
  if (!detail || typeof detail.animate !== 'function') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const style = getComputedStyle(detail)
  const duree = parseFloat(style.getPropertyValue('--duree-douce')) * 1000 || 320
  const courbe = style.getPropertyValue('--courbe-douce').trim() || 'ease'
  const animation = detail.animate([{ translate: '0 0' }, { translate: '-100% 0' }], {
    duration: duree,
    easing: courbe,
    fill: 'forwards',
  })
  // Un onglet en arrière-plan fige les animations : le détail se ferme quand même, à l'heure.
  const secours = new Promise((tenir) => setTimeout(tenir, duree + 100))
  await Promise.race([animation.finished, secours])
}
