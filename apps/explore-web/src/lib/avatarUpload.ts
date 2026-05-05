import { supabase } from './supabase'
import { compressImage } from './imageUtils'

const AVATAR_BUCKET = 'place-images'
const AVATAR_MAX_DIM = 400

/**
 * Compresse + upload un avatar dans Supabase Storage et renvoie son URL publique.
 * - Compresse en webp 400px max (avatars, taille raisonnable)
 * - Écrase le précédent (path = `${userId}/avatar.webp`)
 * - Optionnellement ajoute un cache-bust `?t=…` (à activer pour forcer le refresh
 *   d'un avatar déjà chargé en mémoire — utile en update profil, pas en onboarding)
 *
 * Renvoie `null` en cas d'erreur d'upload (l'appelant gère son fallback / message).
 */
export async function uploadAvatar(
  userId: string,
  file: File,
  opts: { cacheBust?: boolean } = {},
): Promise<string | null> {
  const compressed = await compressImage(file, AVATAR_MAX_DIM)
  const path = `${userId}/avatar.webp`

  // Supprimer l'ancien (policy DELETE exige que le dossier = userId)
  await supabase.storage.from(AVATAR_BUCKET).remove([path])

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, compressed, { contentType: 'image/webp' })
  if (error) return null

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return opts.cacheBust ? `${data.publicUrl}?t=${Date.now()}` : data.publicUrl
}
