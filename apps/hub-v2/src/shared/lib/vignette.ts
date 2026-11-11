/**
 * QUOI     — le chemin (ou l'adresse) de la vignette d'une photo de `community-photos` : `<nom>_thumb.webp`,
 *            400 px, posée à côté de la photo à l'envoi (et par scripts/vignettes-photos-communaute.mjs).
 * POURQUOI — une grille de photos en 1920 px se décode en plusieurs secondes (mesure du 11/11/2026).
 *            Une vidéo n'a pas de vignette : null.
 */
const IMAGE = /\.(webp|jpe?g|png)$/i

export function vignetteDe(chemin: string): string | null {
  if (!IMAGE.test(chemin) || chemin.endsWith('_thumb.webp')) return null
  return chemin.replace(IMAGE, '_thumb.webp')
}
