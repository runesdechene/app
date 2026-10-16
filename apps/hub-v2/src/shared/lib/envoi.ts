/**
 * QUOI     — l'envoi d'un fichier vers un bucket Supabase : vérification avant l'envoi, envoi, retrait vérifié.
 * POURQUOI — bannières, icônes de natures et de cultures passent toutes par là : un fichier refusé
 *            l'est avant de partir (aucun orphelin), et le retrait se déduit de l'adresse publique. L'extension
 *            du nom de fichier se déduit du type, une seule table pour tous les écrans.
 */
import { supabase } from '@/shared/supabase/client'

const OCTETS_PAR_MO = 1024 * 1024

export type RegleFichier = { types: string[]; maxOctets?: number }

// « image/svg+xml » → « SVG », « image/png » → « PNG ».
const nomDuType = (type: string) => type.replace(/^.*\//, '').replace(/\+.*$/, '').toUpperCase()

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg',
}

/** « image/png » → « png » ; un type inconnu donne « jpg ». */
export function extensionDe(fichier: File): string {
  return EXTENSIONS[fichier.type] ?? 'jpg'
}

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

/**
 * Retire des fichiers et vérifie qu'ils ont disparu : quand la RLS filtre, `remove()` rend [] sans erreur.
 * Un fichier déjà absent n'est pas une erreur ; un fichier encore là, si.
 */
export async function retirerFichiers(bucket: string, chemins: string[]): Promise<void> {
  if (chemins.length === 0) return
  const stockage = supabase.storage.from(bucket)
  const { data, error } = await stockage.remove(chemins)
  if (error) throw error
  if (data.length >= chemins.length) return

  for (const chemin of chemins) {
    const rang = chemin.lastIndexOf('/')
    const dossier = rang === -1 ? '' : chemin.slice(0, rang)
    const nom = chemin.slice(rang + 1)
    const { data: restants, error: erreurDeListe } = await stockage.list(dossier, { search: nom })
    if (erreurDeListe) throw erreurDeListe
    if (restants.some((f) => f.name === nom)) {
      throw new Error(`Le fichier n’a pas pu être retiré du stockage (droits ?) : ${chemin}`)
    }
  }
}

/** Le chemin dans le bucket : ce qui suit « /storage/v1/object/public/{bucket}/ » dans l'adresse, sans requête ; null hors de ce bucket. */
export function cheminDepuisAdresse(bucket: string, adresse: string): string | null {
  const debut = `/storage/v1/object/public/${bucket}/`
  const position = adresse.indexOf(debut)
  if (position === -1) return null
  const chemin = adresse.slice(position + debut.length).split(/[?#]/)[0] ?? ''
  return decodeURIComponent(chemin)
}

export async function retirerFichier(bucket: string, adresse: string): Promise<void> {
  const chemin = cheminDepuisAdresse(bucket, adresse)
  if (chemin !== null) await retirerFichiers(bucket, [chemin])
}
