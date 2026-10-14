/**
 * QUOI     — l'envoi d'un fichier vers un bucket Supabase : vérification avant l'envoi, envoi, retrait.
 * POURQUOI — bannières, icônes de natures et de cultures passent toutes par là : un fichier refusé
 *            l'est avant de partir (aucun orphelin), et le retrait se déduit de l'adresse publique.
 */
import { supabase } from '@/shared/supabase/client'

const OCTETS_PAR_MO = 1024 * 1024

export type RegleFichier = { types: string[]; maxOctets?: number }

// « image/svg+xml » → « SVG », « image/png » → « PNG ».
const nomDuType = (type: string) => type.replace(/^.*\//, '').replace(/\+.*$/, '').toUpperCase()

export function verifierFichier(f: File, regle: RegleFichier): string | null {
  if (!regle.types.includes(f.type)) {
    return `Ce type de fichier n’est pas accepté (${regle.types.map(nomDuType).join(', ')}).`
  }
  if (regle.maxOctets !== undefined && f.size > regle.maxOctets) {
    return `Le fichier dépasse ${String(Math.floor(regle.maxOctets / OCTETS_PAR_MO))} Mo.`
  }
  return null
}

export async function envoyerFichier(bucket: string, chemin: string, f: File): Promise<string> {
  const stockage = supabase.storage.from(bucket)
  const { error } = await stockage.upload(chemin, f, { contentType: f.type, upsert: true })
  if (error) throw error
  return stockage.getPublicUrl(chemin).data.publicUrl
}

// Le chemin dans le bucket est ce qui suit « /storage/v1/object/public/{bucket}/ » dans l'adresse.
export async function retirerFichier(bucket: string, adresse: string): Promise<void> {
  const debut = `/storage/v1/object/public/${bucket}/`
  const position = adresse.indexOf(debut)
  if (position === -1) return
  const chemin = decodeURIComponent(adresse.slice(position + debut.length))
  const { error } = await supabase.storage.from(bucket).remove([chemin])
  if (error) throw error
}
