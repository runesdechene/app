/**
 * QUOI     — change la photo de profil : réduite en webp 400 px, envoyée, puis enregistrée.
 * POURQUOI — même emplacement que la V1 (`place-images/<identifiant>/avatar.webp`) : les deux
 *            versions montrent la même photo. `?t=` force les navigateurs à recharger l'image.
 * ATTENTION — le seau n'a pas de droit de mise à jour, seulement d'ajout et de suppression par
 *            son propriétaire : on supprime l'ancienne photo avant d'envoyer la nouvelle.
 */
import { supabase } from '@/shared/supabase/client'
import { monIdentifiant } from './session'

const SEAU = 'place-images'
const COTE_MAX = 400

async function versWebp(fichier: File): Promise<Blob> {
  const image = await createImageBitmap(fichier)
  const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * echelle)
  canvas.height = Math.round(image.height * echelle)
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Image illisible'))
      },
      'image/webp',
      0.85,
    )
  })
}

export async function changerAvatar(fichier: File): Promise<string> {
  const moi = await monIdentifiant()
  if (!moi) throw new Error('Connexion requise')
  const chemin = `${moi}/avatar.webp`
  const image = await versWebp(fichier)

  await supabase.storage.from(SEAU).remove([chemin])
  const envoi = await supabase.storage
    .from(SEAU)
    .upload(chemin, image, { contentType: 'image/webp' })
  if (envoi.error) throw envoi.error

  const url = `${supabase.storage.from(SEAU).getPublicUrl(chemin).data.publicUrl}?t=${String(Date.now())}`
  const { error } = await supabase.rpc('update_my_profile', { p_user_id: moi, p_avatar_url: url })
  if (error) throw error
  return url
}
