/**
 * QUOI     — lit et écrit les deux réglages de « Réglages » : le texte de partage et l'image des pages SEO
 *            (table app_settings, une ligne par clé), et envoie la nouvelle image dans le bucket app-assets.
 * POURQUOI — écriture directe (politique app_settings_admin_write, admins) en upsert : l'ancien update ne faisait
 *            rien si la ligne manquait. Le fichier choisi ne part qu'à l'enregistrement ; l'ancien quitte le bucket
 *            une fois la base à jour (sauf si une autre clé la montre encore), et un upsert qui échoue défait l'envoi.
 */
import { envoyerFichier, extensionDe, retirerFichier } from '@/shared/lib/envoi'
import { messageDErreur } from '@/shared/lib/erreur'
import { supabase } from '@/shared/supabase/client'

export const BUCKET = 'app-assets'
const CLE_PARTAGE = 'share_text_template'
const CLE_IMAGE = 'landing_image_desktop_url'

export type Reglages = { partage: string; imageSeo: string; partageModifieLe: string | null }

export async function lireReglages(): Promise<Reglages> {
  const { data, error } = await supabase.from('app_settings').select('key, value, updated_at').in('key', [CLE_PARTAGE, CLE_IMAGE])
  if (error) throw new Error(error.message)
  const partage = data.find((l) => l.key === CLE_PARTAGE)
  return {
    partage: partage?.value ?? '',
    imageSeo: data.find((l) => l.key === CLE_IMAGE)?.value ?? '',
    partageModifieLe: partage?.updated_at ?? null,
  }
}

async function ecrire(key: string, value: string): Promise<void> {
  const { error } = await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}

export const enregistrerPartage = (texte: string) => ecrire(CLE_PARTAGE, texte)

export const enregistrerImageSeo = (adresse: string) => ecrire(CLE_IMAGE, adresse)

// Une autre clé (le fond de /soumettre-contenu) peut pointer vers le même fichier : on ne l'efface pas sous elle.
async function encoreUtilisee(adresse: string): Promise<boolean> {
  const { data, error } = await supabase.from('app_settings').select('key').eq('value', adresse).neq('key', CLE_IMAGE)
  if (error) throw new Error(`Enregistrée, mais l’ancienne image n’a pas pu être vérifiée : ${error.message}`)
  return data.length > 0
}

/** Envoie le fichier, écrit l'adresse, puis retire l'ancienne image ; le retrait qui échoue est dit comme un succès partiel. */
export async function remplacerImageSeo(fichier: File, ancienne: string): Promise<void> {
  const chemin = `landing-image-desktop-${String(Date.now())}.${extensionDe(fichier)}`
  const adresse = await envoyerFichier(BUCKET, chemin, fichier)
  try {
    await enregistrerImageSeo(adresse)
  } catch (e) {
    await retirerFichier(BUCKET, adresse).catch(() => undefined)
    throw e
  }
  if (!ancienne || (await encoreUtilisee(ancienne))) return
  try {
    await retirerFichier(BUCKET, ancienne)
  } catch (e) {
    throw new Error(`Enregistrée, mais l’ancienne image n’a pas pu être retirée : ${messageDErreur(e)}`, { cause: e })
  }
}
