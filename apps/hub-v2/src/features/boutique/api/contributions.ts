/**
 * QUOI     — lit les contributions (hub_contributions, mig 521), les étiquettes de photo, et écrit : décider
 *            (valider, archiver), corriger le message, poser et retirer une étiquette.
 * POURQUOI — la base décide (garde de l'équipe, couronnes versées une seule fois) : son message remonte tel quel.
 */
import { supabase } from '@/shared/supabase/client'

export type StatutContribution = 'pending' | 'approved' | 'archived'
export type Filtre = StatutContribution | 'toutes'

export type PhotoDeContribution = {
  id: string; url: string; chemin: string | null; taille: string | null
  produit_id: string | null; produit_handle: string | null; produit_titre: string | null
  media: string | null; communaute: boolean; mur: boolean
}
export type Etiquette = { id: string; nom: string }
export type Contribution = {
  id: string; quand: string | null; statut: StatutContribution; nom: string; email: string | null
  instagram: string | null; role: string | null; compte: string | null; lieu: string | null
  code_postal: string | null; departement: string | null; message: string | null; note_equipe: string | null
  taille: string | null; produit: string | null; hauteur: number | null; epaules: number | null
  note_experience: number | null; note_produits: number | null; diffusion: boolean
  recompensee_le: string | null; images: PhotoDeContribution[]; etiquettes: Etiquette[]
}
export type ListeContributions = {
  total: number
  compteurs: { a_valider: number; publiees: number; archivees: number; au_mur: number; plus_ancienne: string | null }
  lignes: Contribution[]
}
export type Criteres = { filtre: Filtre; recherche: string; limite: number; decalage: number }

export async function lireContributions(c: Criteres): Promise<ListeContributions> {
  const { data, error } = await supabase.rpc('hub_contributions', {
    p_statut: c.filtre, p_recherche: c.recherche, p_limite: c.limite, p_decalage: c.decalage,
  })
  if (error) throw new Error(error.message)
  return data as ListeContributions
}

export async function lireEtiquettes(): Promise<Etiquette[]> {
  const { data, error } = await supabase.rpc('get_photo_tags')
  if (error) throw new Error(error.message)
  return data.map((t) => ({ id: t.id, nom: t.name }))
}

export async function modererContribution(id: string, statut: StatutContribution, couronnes?: number): Promise<void> {
  const { error } = await supabase.rpc('moderate_submission', {
    p_submission_id: id, p_status: statut, ...(couronnes !== undefined && { p_crowns: couronnes }),
  })
  if (error) throw new Error(error.message)
}

/** Les types générés n'acceptent pas null : un message vidé s'écrit une chaîne vide. */
export async function modifierMessage(id: string, message: string | null): Promise<void> {
  const { error } = await supabase.rpc('update_submission_message', { p_submission_id: id, p_message: message ?? '' })
  if (error) throw new Error(error.message)
}

export async function ajouterEtiquette(id: string, etiquette: string): Promise<void> {
  const { error } = await supabase.rpc('add_tag_to_submission', { p_submission_id: id, p_tag_id: etiquette })
  if (error) throw new Error(error.message)
}

export async function retirerEtiquette(id: string, etiquette: string): Promise<void> {
  const { error } = await supabase.rpc('remove_tag_from_submission', { p_submission_id: id, p_tag_id: etiquette })
  if (error) throw new Error(error.message)
}

export async function creerEtiquette(nom: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_photo_tag', { p_name: nom })
  if (error) throw new Error(error.message)
  return data
}
