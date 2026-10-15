/**
 * QUOI     — ce que /soumettre-contenu accepte : dix contenus au plus, des photos de 15 Mo et des
 *            vidéos de 50 Mo au plus, dans une liste de formats.
 * POURQUOI — un refus se dit au moment du choix, avec le nom du fichier : rien ne part pour être
 *            refusé ensuite. Le format se lit à l'extension, car un téléphone donne souvent un type
 *            vide aux photos HEIC.
 */
export const MAX_FICHIERS = 10

const MO = 1024 * 1024
const PHOTOS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']
const VIDEOS = ['mp4', 'mov', 'webm', 'm4v']
const LIMITE_PHOTO_MO = 15
const LIMITE_VIDEO_MO = 50

const extension = (f: File) => f.name.split('.').pop()?.toLowerCase() ?? ''

export const estVideo = (f: File) => VIDEOS.includes(extension(f))

export function refusDuFichier(f: File): string | null {
  const video = estVideo(f)
  if (!video && !PHOTOS.includes(extension(f))) {
    return `« ${f.name} » n’est pas accepté : photos JPG, PNG, WebP ou HEIC, vidéos MP4, MOV, WebM ou M4V.`
  }
  const limite = video ? LIMITE_VIDEO_MO : LIMITE_PHOTO_MO
  if (f.size > limite * MO) {
    const taille = (f.size / MO).toFixed(1).replace('.', ',')
    return `« ${f.name} » fait ${taille} Mo : la limite est de ${String(limite)} Mo pour ${video ? 'une vidéo' : 'une photo'}.`
  }
  return null
}

/** Les fichiers choisis, triés : ceux qui entrent, et la raison de chaque refus. */
export function trierLesAjouts(dejaLa: number, nouveaux: File[]): { acceptes: File[]; refus: string[] } {
  const acceptes: File[] = []
  const refus: string[] = []
  for (const f of nouveaux) {
    const raison = refusDuFichier(f)
    if (raison) refus.push(raison)
    else if (dejaLa + acceptes.length >= MAX_FICHIERS) {
      refus.push(`« ${f.name} » n’est pas ajouté : ${String(MAX_FICHIERS)} contenus au plus.`)
    } else acceptes.push(f)
  }
  return { acceptes, refus }
}
