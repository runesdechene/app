/**
 * QUOI     — une photo réduite à 1920 px au plus et convertie en WebP (qualité 0,82), avant l'envoi.
 * POURQUOI — une photo de téléphone pèse 5 à 10 Mo ; le joueur l'envoie souvent depuis un réseau
 *            mobile, et le Hub n'en a pas besoin de plus. Réglages repris de l'ancien StudioSubmit.
 *            Une vidéo passe telle quelle : le navigateur ne sait pas la réduire.
 * ATTENTION — une photo que le navigateur ne sait pas lire (HEIC hors Safari) fait échouer la
 *            promesse : l'appelant envoie alors le fichier d'origine.
 */
import { estVideo } from './fichiers'

const COTE_MAX = 1920
const QUALITE = 0.82

function lireImage(f: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const adresse = URL.createObjectURL(f)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(adresse)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(adresse)
      reject(new Error('Image illisible'))
    }
    image.src = adresse
  })
}

export async function versWebp(f: File): Promise<File> {
  if (estVideo(f)) return f
  const image = await lireImage(f)
  const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height))
  const toile = document.createElement('canvas')
  toile.width = Math.round(image.width * echelle)
  toile.height = Math.round(image.height * echelle)
  const contexte = toile.getContext('2d')
  if (!contexte) throw new Error('Canvas indisponible')
  contexte.drawImage(image, 0, 0, toile.width, toile.height)

  const webp = await new Promise<Blob | null>((resolve) => {
    toile.toBlob(resolve, 'image/webp', QUALITE)
  })
  if (!webp) throw new Error('Compression échouée')
  return new File([webp], f.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' })
}
