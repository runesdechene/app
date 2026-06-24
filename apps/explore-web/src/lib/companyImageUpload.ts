import { supabase } from './supabase'
import { compressImage } from './imageUtils'

const BUCKET = 'company-emblems'
const MAX_DIM = 800

/**
 * Chemin de stockage de l'emblème d'une compagnie.
 * PUR — testé unitairement.
 */
export function companyImagePath(companyId: string): string {
  return `companies/${companyId}.webp`
}

/**
 * Compresse (WebP 800px max) + upload l'emblème d'une compagnie dans le bucket
 * `company-emblems`, écrase le précédent (upsert), et renvoie l'URL publique.
 *
 * Lève une Error si l'upload échoue (l'appelant affiche son message d'erreur).
 */
export async function uploadCompanyImage(companyId: string, file: File): Promise<string> {
  const compressed = await compressImage(file, MAX_DIM)
  const path = companyImagePath(companyId)

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, compressed, { upsert: true, contentType: 'image/webp' })

  if (error) {
    console.error('[company] uploadCompanyImage error:', error.message)
    throw new Error(error.message)
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
