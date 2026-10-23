/**
 * QUOI     — penche une photo avant de la déposer : les boîtes de réception ne savent pas pivoter une image,
 *            la photo part donc déjà inclinée, sur le fond de la lettre (JPEG, 1 200 px de large au plus).
 * POURQUOI — la maquette pose ses photos d'un bord à l'autre, légèrement penchées, les coins débordant
 *            du cadre : le dessin est un peu plus large que l'image rendue, et ses coins sont coupés.
 * ATTENTION — le fond est cuit dans les coins : on ne penche qu'au moment de l'envoi (lib/envoi), avec les
 *             couleurs finales. Au dépôt, la photo est seulement réduite (0°).
 */

const LARGEUR_MAX = 1200
// Combien le dessin dépasse la largeur rendue quand il penche (680 px pour 600, maquette 748:2533).
const DEBORD = 1.13

export type Mesures = { largeur: number; hauteur: number; dessinLargeur: number; dessinHauteur: number }

export function mesuresPenchees(largeurSource: number, hauteurSource: number, degres: number): Mesures {
  const largeur = Math.min(LARGEUR_MAX, largeurSource)
  if (degres === 0) {
    const hauteur = Math.round((largeur * hauteurSource) / largeurSource)
    return { largeur, hauteur, dessinLargeur: largeur, dessinHauteur: hauteur }
  }
  const dessinLargeur = Math.round(largeur * DEBORD)
  const dessinHauteur = Math.round((dessinLargeur * hauteurSource) / largeurSource)
  const angle = (Math.abs(degres) * Math.PI) / 180
  // La hauteur garde l'image entière et la moitié de ce que la pente ajoute : les coins sont coupés.
  const hauteur = Math.round(dessinHauteur * Math.cos(angle) + (dessinLargeur * Math.sin(angle)) / 2)
  return { largeur, hauteur, dessinLargeur, dessinHauteur }
}

export async function pencher(photo: Blob, degres: number, fond: string): Promise<Blob> {
  const image = await createImageBitmap(photo)
  const m = mesuresPenchees(image.width, image.height, degres)
  const toile = document.createElement('canvas')
  toile.width = m.largeur
  toile.height = m.hauteur
  const crayon = toile.getContext('2d')
  if (!crayon) throw new Error('Ce navigateur ne sait pas préparer la photo.')
  crayon.fillStyle = fond
  crayon.fillRect(0, 0, m.largeur, m.hauteur)
  crayon.translate(m.largeur / 2, m.hauteur / 2)
  crayon.rotate((degres * Math.PI) / 180)
  crayon.drawImage(image, -m.dessinLargeur / 2, -m.dessinHauteur / 2, m.dessinLargeur, m.dessinHauteur)
  return new Promise((resolve, reject) => {
    toile.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('La photo n’a pas pu être préparée.'))
    }, 'image/jpeg', 0.85)
  })
}
