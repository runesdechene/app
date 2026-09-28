/**
 * QUOI     — la durée du mouvement doux de la DA (`--duree-douce`), en millisecondes.
 * POURQUOI — MapLibre anime la carte lui-même et ne lit pas le CSS : pour qu'elle glisse au
 *            même rythme que le tiroir, on lui passe la durée du jeton.
 */
export function dureeDouce(racine: HTMLElement): number {
  const secondes = parseFloat(getComputedStyle(racine).getPropertyValue('--duree-douce'))
  return Number.isNaN(secondes) ? 0 : secondes * 1000
}
