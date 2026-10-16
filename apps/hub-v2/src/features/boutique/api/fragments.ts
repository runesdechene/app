/**
 * QUOI     — lit les Fragments (table title_fragments), les synchronise depuis Shopify, en ajoute un et
 *            enregistre sa fiche (origine, culture, visibilité).
 * POURQUOI — lecture directe de la table publique ; l'écriture passe par les fonctions serveur
 *            (synchroniser_fragments, ajouter_fragment, hub_enregistrer_fragment), qui font foi pour les règles de liaison.
 */
import { supabase } from '@/shared/supabase/client'
import type { Illustration } from './shopify'

export type Fragment = {
  id: number; name: string; link_url: string | null; visible: boolean; shopify_handle: string | null
  resume: string | null; histoire: string | null; illustration_url: string | null; image_url: string | null
  illustration_sombre_url: string | null; audio_url: string | null; artiste: string | null
  narrateur: string | null; heritage: string | null; synchronise_le: string | null
  origine_lat: number | null; origine_lng: number | null; origine_nom: string | null; theme: string | null
}

const COLONNES = 'id, name, link_url, visible, shopify_handle, resume, histoire, illustration_url, image_url, illustration_sombre_url, audio_url, artiste, narrateur, heritage, synchronise_le, origine_lat, origine_lng, origine_nom, theme'

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

export type FragmentAEcrire = Pick<Fragment, 'id' | 'origine_lat' | 'origine_lng' | 'origine_nom' | 'visible' | 'theme'>

// Sans origine, la latitude et la longitude sont omises : la base lit « aucune origine » (pas un zéro).
export async function enregistrerFragment(f: FragmentAEcrire): Promise<void> {
  const { error } = await supabase.rpc('hub_enregistrer_fragment', {
    p_id: f.id, p_visible: f.visible, p_theme: f.theme ?? '', p_origine_nom: f.origine_nom ?? '',
    ...(f.origine_lat !== null && f.origine_lng !== null ? { p_origine_lat: f.origine_lat, p_origine_lng: f.origine_lng } : {}),
  })
  if (error) throw new Error(error.message)
}

/** Donne un Fragment à un compte (le Fragment + une ligne de journal « manual », mig 521). */
export async function associerAuCompte(compte: string, fragment: number): Promise<void> {
  const { error } = await supabase.rpc('hub_associer_fragment', { p_user: compte, p_fragment: fragment })
  if (error) throw new Error(error.message)
}
