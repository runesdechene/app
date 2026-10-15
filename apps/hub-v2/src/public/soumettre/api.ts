/**
 * QUOI     — ce que /soumettre-contenu lit et écrit, sans compte (clé anon) : les missions ouvertes,
 *            le réglage de la page (photo de fond, Couronnes de bienvenue), le dépôt d'un fichier,
 *            puis l'enregistrement de l'envoi par `deposer_contenu` (mig 501).
 * POURQUOI — le visiteur vient d'un QR imprimé : il ne lit que des phrases écrites pour lui. Le refus
 *            « 5 envois par heure » est déjà rédigé pour lui par la base (indice `limite`) ; toute
 *            autre erreur devient une seule phrase, jamais le texte du serveur (même règle que
 *            cadeau/api.ts).
 */
import { supabase } from '@/shared/supabase/client'
import { typeDuFichier } from './lib/fichiers'

export const TROP_D_ENVOIS = 'Trop d’envois d’un coup : réessaie dans une heure.'
export const PAS_ENREGISTRE = 'Ton envoi n’a pas pu être enregistré, réessaie dans un instant.'

export type Mission = { slug: string; title: string }
export type ConfigStudio = { fond: string; colonne: string; couronnes: number }
export type Depot = {
  email: string
  nom: string
  images: { path: string; size: string | null }[]
  accordMarque: boolean
  accordCompte: boolean
  message: string
  departement: string
  quete: string
  tailleCm: number | null
  noteExperience: number
  noteProduits: number
  motEquipe: string
}

export async function lireMissions(): Promise<Mission[]> {
  const { data, error } = await supabase
    .from('missions')
    .select('slug, title')
    .eq('status', 'published')
    .order('starts_at', { ascending: false })
  if (error) throw error
  return data
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

export async function lireConfigStudio(): Promise<ConfigStudio> {
  const { data, error } = await supabase.rpc('get_studio_config')
  if (error) throw error
  const c = estObjet(data) ? data : {}
  return {
    fond: typeof c.bg_image_url === 'string' ? c.bg_image_url : '',
    colonne: typeof c.aside_image_url === 'string' ? c.aside_image_url : '',
    couronnes: typeof c.welcome_crowns === 'number' ? c.welcome_crowns : 0,
  }
}

/** Dépose un fichier dans community-photos/submissions/<dossier>/ et rend son chemin. */
export async function envoyerFichierPublic(f: File, dossier: string): Promise<string> {
  const extension = f.name.split('.').pop()?.toLowerCase() ?? 'webp'
  const chemin = `submissions/${dossier}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage
    .from('community-photos')
    .upload(chemin, f, { contentType: typeDuFichier(f) ?? f.type, upsert: false })
  if (error) throw error
  return chemin
}

// Un champ facultatif vide n'est pas envoyé : la fonction prend alors NULL, sa valeur par défaut.
export async function deposerContenu(d: Depot): Promise<{ nouveauCompte: boolean }> {
  const message = d.message.trim()
  const departement = d.departement.trim()
  const quete = d.quete.trim()
  const motEquipe = d.motEquipe.trim()
  const { data, error } = await supabase.rpc('deposer_contenu', {
    p_email: d.email.trim(),
    p_nom: d.nom.trim(),
    p_images: d.images,
    p_consent_brand: d.accordMarque,
    p_consent_account: d.accordCompte,
    ...(message ? { p_message: message } : {}),
    ...(departement ? { p_departement: departement } : {}),
    ...(quete ? { p_quest_ref: quete } : {}),
    ...(motEquipe ? { p_team_note: motEquipe } : {}),
    ...(d.tailleCm !== null ? { p_model_height_cm: d.tailleCm } : {}),
    ...(d.noteExperience > 0 ? { p_rating_experience: d.noteExperience } : {}),
    ...(d.noteProduits > 0 ? { p_rating_products: d.noteProduits } : {}),
  })
  if (error) throw new Error(error.hint === 'limite' ? TROP_D_ENVOIS : PAS_ENREGISTRE)
  return { nouveauCompte: estObjet(data) && data.nouveauCompte === true }
}
