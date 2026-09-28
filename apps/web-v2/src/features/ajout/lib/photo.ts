/**
 * QUOI     — préparer une photo avant l'envoi : une grande (1920 px au plus) et une vignette
 *            (400 px), en WebP ; et lire où elle a été prise, si l'appareil l'a noté.
 * POURQUOI — les photos d'un téléphone pèsent plusieurs Mo : on les réduit dès qu'elles sont
 *            choisies, comme les lieux de la V1 (mêmes tailles, même format, même dossier). La
 *            position de la photo place d'abord l'épingle (maquette 288:178) : on la lit avec
 *            exifr, la bibliothèque standard, plutôt qu'un lecteur maison.
 */
import exifr from 'exifr'
import type { Point } from '@/shared/lib/distance'

export const GRANDE = 1920
export const VIGNETTE = 400
const QUALITE = 0.82

// Tenir dans un carré de `cote` sans se déformer, et sans jamais agrandir.
export function dimensions(largeur: number, hauteur: number, cote: number) {
  const echelle = Math.min(1, cote / Math.max(largeur, hauteur))
  return { largeur: Math.round(largeur * echelle), hauteur: Math.round(hauteur * echelle) }
}

async function reduire(image: ImageBitmap, cote: number): Promise<Blob> {
  const { largeur, hauteur } = dimensions(image.width, image.height, cote)
  const toile = document.createElement('canvas')
  toile.width = largeur
  toile.height = hauteur
  toile.getContext('2d')?.drawImage(image, 0, 0, largeur, hauteur)
  return new Promise((resolve, reject) => {
    toile.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('photo illisible'))
      },
      'image/webp',
      QUALITE,
    )
  })
}

export type PhotoPreparee = { grande: Blob; vignette: Blob }

export async function preparerPhoto(fichier: File): Promise<PhotoPreparee> {
  // imageOrientation : une photo prise en portrait reste en portrait.
  const image = await createImageBitmap(fichier, { imageOrientation: 'from-image' })
  try {
    return { grande: await reduire(image, GRANDE), vignette: await reduire(image, VIGNETTE) }
  } finally {
    image.close()
  }
}

export async function positionDeLaPhoto(fichier: File): Promise<Point | null> {
  try {
    const gps = await exifr.gps(fichier)
    if (!Number.isFinite(gps.latitude) || !Number.isFinite(gps.longitude)) return null
    return { latitude: gps.latitude, longitude: gps.longitude }
  } catch {
    return null // pas d'EXIF, ou un format qu'exifr ne lit pas : on placera l'épingle autrement
  }
}
