/**
 * QUOI     — lit, ajoute et retire les correspondances Shopify (table shopify_unlocks) : une étiquette de
 *            produit débloque un Fragment.
 * POURQUOI — écriture directe sur la table (politique admin) ; l'étiquette est enregistrée comme le webhook
 *            la lit (rognée, minuscules) ; un doublon (code 23505) se dit en clair.
 */
import { supabase } from '@/shared/supabase/client'
import { etiquetteNormale } from '../lib/achats'

export type Correspondance = { id: number; shopify_tag: string; unlock_ref_id: number; created_at: string | null }

export async function lireCorrespondances(): Promise<Correspondance[]> {
  const { data, error } = await supabase
    .from('shopify_unlocks').select('id, shopify_tag, unlock_ref_id, created_at')
    .eq('unlock_type', 'fragment').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function ajouterCorrespondance(tag: string, fragmentId: number): Promise<void> {
  const { error } = await supabase
    .from('shopify_unlocks').insert({ shopify_tag: etiquetteNormale(tag), unlock_type: 'fragment', unlock_ref_id: fragmentId })
  if (error) throw new Error(error.code === '23505' ? 'Cette correspondance existe déjà.' : error.message)
}

export async function retirerCorrespondance(id: number): Promise<void> {
  const { error } = await supabase.from('shopify_unlocks').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
