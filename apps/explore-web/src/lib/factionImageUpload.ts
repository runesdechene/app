import { supabase } from './supabase'
import { compressImage } from './imageUtils'

const BUCKET = 'faction-emblems'
const MAX_DIM = 800

/**
 * Chemin de stockage de l'emblème d'une Compagnie (mécanique = faction).
 * PUR — testable unitairement.
 */
export function factionImagePath(factionId: string): string {
  return `factions/${factionId}.webp`
}

/**
 * Compresse (WebP 800px max) + upload l'emblème dans le bucket `faction-emblems`,
 * écrase le précédent (upsert), renvoie l'URL publique. Lève une Error si l'upload échoue.
 */
export async function uploadFactionImage(factionId: string, file: File): Promise<string> {
  const compressed = await compressImage(file, MAX_DIM)
  const path = factionImagePath(factionId)

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, compressed, { upsert: true, contentType: 'image/webp' })

  if (error) {
    console.error('[faction] uploadFactionImage error:', error.message)
    throw new Error(error.message)
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
