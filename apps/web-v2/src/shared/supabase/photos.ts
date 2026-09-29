/**
 * QUOI     — envoyer des photos dans le dossier du compte (`place-images/places/<moi>/`) : la grande
 *            et sa vignette, une photo après l'autre.
 * POURQUOI — l'ajout d'un lieu, « Modifier la fiche » et le Carnet de passage envoient leurs photos
 *            de la même façon ; la base vérifie ensuite que chacune est bien dans ce dossier.
 * ATTENTION — `upsert` : une pose ratée se rejoue sans buter sur une photo déjà partie.
 */
import type { PhotoAEnvoyer } from '@/shared/lib/photo'
import { supabase } from './client'

const SEAU = 'place-images'

export type ImageEnvoyee = { id: string; url: string; thumb: string }

async function envoyer(chemin: string, blob: Blob) {
  const { error } = await supabase.storage
    .from(SEAU)
    .upload(chemin, blob, { contentType: 'image/webp', upsert: true })
  if (error) throw error
  return supabase.storage.from(SEAU).getPublicUrl(chemin).data.publicUrl
}

export async function envoyerPhotos(photos: PhotoAEnvoyer[]): Promise<ImageEnvoyee[]> {
  const { data } = await supabase.auth.getSession()
  const moi = data.session?.user.id
  if (!moi) throw new Error('Connexion requise')
  const images: ImageEnvoyee[] = []
  // Une à une : sur un téléphone en montagne, dix envois à la fois échouent ensemble.
  for (const photo of photos) {
    const dossier = `places/${moi}/${photo.id}`
    const url = await envoyer(`${dossier}.webp`, photo.grande)
    const thumb = await envoyer(`${dossier}_thumb.webp`, photo.vignette)
    images.push({ id: photo.id, url, thumb })
  }
  return images
}
