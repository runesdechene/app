/**
 * QUOI     — lit les Fragments (table title_fragments), les synchronise depuis Shopify et en ajoute un.
 * POURQUOI — lecture directe de la table publique ; l'écriture passe par les fonctions serveur
 *            (synchroniser_fragments, ajouter_fragment), qui font foi pour les règles de liaison.
 */
import { supabase } from '@/shared/supabase/client'
import type { Illustration } from './shopify'

export type Fragment = {
  id: number; name: string; link_url: string | null; visible: boolean; shopify_handle: string | null
  resume: string | null; histoire: string | null; illustration_url: string | null
  illustration_sombre_url: string | null; audio_url: string | null; artiste: string | null
  narrateur: string | null; heritage: string | null; synchronise_le: string | null
  origine_lat: number | null; origine_lng: number | null; origine_nom: string | null; theme: string | null
}

const COLONNES = 'id, name, link_url, visible, shopify_handle, resume, histoire, illustration_url, illustration_sombre_url, audio_url, artiste, narrateur, heritage, synchronise_le, origine_lat, origine_lng, origine_nom, theme'

export async function lireFragments(): Promise<Fragment[]> {
  const { data, error } = await supabase.from('title_fragments').select(COLONNES).order('name')
  if (error) throw new Error(error.message)
  return data
}

export async function synchroniserFragments(ills: Illustration[]): Promise<number> {
  const { data, error } = await supabase.rpc('synchroniser_fragments', { p_illustrations: ills })
  if (error) throw new Error(error.message)
  return data
}

// Le Fragment est créé depuis la collection du motif, puis rempli par la synchro de ce seul motif.
export async function ajouterFragment(ill: Illustration): Promise<number> {
  const { data, error } = await supabase.rpc('ajouter_fragment', { p_nom: ill.nom, p_collection: ill.collection })
  if (error) throw new Error(error.message)
  await synchroniserFragments([ill])
  return data
}
