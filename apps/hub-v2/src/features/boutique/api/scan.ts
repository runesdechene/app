/**
 * QUOI     — le scan des Fragments : les vues et les scans (scan_du_hub), le recalcul des empreintes d'un
 *            Fragment (remplacer_empreintes_illustration) et le retrait d'une vue.
 * POURQUOI — l'empreinte se calcule dans le navigateur (lib/empreintes) avec le même modèle que
 *            l'appli ; la base ne fait que ranger les vecteurs.
 */
import { supabase } from '@/shared/supabase/client'
import { calculerEmpreintes } from '../lib/empreintes'
import type { Fragment } from './fragments'

export const MODELE = 'mobilenet_v3_small'

export type ScanDUnFragment = {
  id: number; illustrations: number; vues: { id: number; le: string; par: string | null }[]
  scans7: number; scans30: number
}

export async function lireScans(): Promise<ScanDUnFragment[]> {
  const { data, error } = await supabase.rpc('scan_du_hub', { p_modele: MODELE })
  if (error) throw new Error(error.message)
  return data as ScanDUnFragment[]
}

export async function recalculerEmpreintes(
  f: Pick<Fragment, 'id' | 'illustration_url' | 'illustration_sombre_url'>,
): Promise<number> {
  const vecteurs = await calculerEmpreintes([f.illustration_url, f.illustration_sombre_url])
  const { data, error } = await supabase.rpc('remplacer_empreintes_illustration', {
    p_fragment: f.id, p_vecteurs: vecteurs, p_modele: MODELE,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function retirerEmpreinte(id: number): Promise<void> {
  const { error } = await supabase.rpc('retirer_empreinte', { p_id: id })
  if (error) throw new Error(error.message)
}
