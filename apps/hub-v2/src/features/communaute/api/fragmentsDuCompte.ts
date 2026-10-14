/**
 * QUOI     — lit les Fragments qu'on peut associer à un compte, et associe / retire un Fragment à la main.
 * POURQUOI — l'association passe par une fonction (hub_associer_fragment : le Fragment du compte + une ligne
 *            de journal d'achat « manual », en un coup) ; le retrait efface la ligne, sans journal.
 */
import { supabase } from '@/shared/supabase/client'

export type FragmentAssociable = { id: number; nom: string; image: string | null }

export async function lireFragmentsAssociables(): Promise<FragmentAssociable[]> {
  const { data, error } = await supabase.from('title_fragments').select('id, name, illustration_url, image_url').order('name')
  if (error) throw new Error(error.message)
  return data.map((f) => ({ id: f.id, nom: f.name, image: f.illustration_url ?? f.image_url }))
}

export async function associerFragment(compte: string, fragment: number): Promise<void> {
  const { error } = await supabase.rpc('hub_associer_fragment', { p_user: compte, p_fragment: fragment })
  if (error) throw new Error(error.message)
}

export async function retirerFragment(compte: string, fragment: number): Promise<void> {
  const { error } = await supabase.rpc('hub_retirer_fragment', { p_user: compte, p_fragment: fragment })
  if (error) throw new Error(error.message)
}
