/**
 * QUOI     — change la photo de profil : réduite en webp 400 px, envoyée, puis enregistrée.
 * POURQUOI — la nouvelle photo part sous un nom NEUF (`avatar-<horodatage>.webp`, dans le
 *            dossier de l'Explorateur, seau `place-images` comme en V1). Tant qu'elle n'est
 *            pas envoyée et enregistrée, l'ancienne reste en place : une coupure réseau ne
 *            laisse jamais une image cassée. Le nom neuf suffit aussi à rafraîchir les caches.
 * ATTENTION — les anciennes photos du dossier sont supprimées à la fin, sans bloquer si ça
 *            échoue (un fichier orphelin ne gêne personne).
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
  const seau = supabase.storage.from(SEAU)
  const nom = `avatar-${String(Date.now())}.webp`

  const envoi = await seau.upload(`${moi}/${nom}`, await versWebp(fichier), {
    contentType: 'image/webp',
  })
  if (envoi.error) throw envoi.error

  const url = seau.getPublicUrl(`${moi}/${nom}`).data.publicUrl
  const { error } = await supabase.rpc('update_my_profile', { p_user_id: moi, p_avatar_url: url })
  if (error) throw error

  const { data: fichiers } = await seau.list(moi)
  const anciennes = (fichiers ?? [])
    .filter((f) => f.name.startsWith('avatar') && f.name !== nom)
    .map((f) => `${moi}/${f.name}`)
  if (anciennes.length > 0) await seau.remove(anciennes)
  return url
}
