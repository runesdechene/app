/**
 * QUOI     — les deux lectures de la carte : tous les lieux vus par l'Explorateur connecté, et
 *            le territoire sous un point.
 * POURQUOI — les deux fonctions lisent `auth.uid()` (migration 363) : l'état de chaque lieu
 *            (inconnu, connu, visité) est celui de la personne qui regarde.
 */
import { supabase } from '@/shared/supabase/client'
import { lireLieux, lireTerritoire, type LieuCarte, type Territoire } from './lireCarte'

export async function fetchCarteLieux(): Promise<LieuCarte[]> {
  const { data, error } = await supabase.rpc('carte_lieux')
  if (error) throw error
  return lireLieux(data)
}

export async function fetchTerritoire(lat: number, lng: number): Promise<Territoire> {
  const { data, error } = await supabase.rpc('territoire_en', { p_lat: lat, p_lng: lng })
  if (error) throw error
  return lireTerritoire(data)
}
