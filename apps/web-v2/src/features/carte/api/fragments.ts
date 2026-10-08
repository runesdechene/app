/**
 * QUOI     — les Fragments de la carte côté Supabase.
 * POURQUOI — une RPC ouverte à tous (migration 458) ; le JSON est lu par `lireFragments.ts`.
 */
import { supabase } from '@/shared/supabase/client'
import { lireFragments } from './lireFragments'

export async function fetchFragmentsSurLaCarte() {
  const { data, error } = await supabase.rpc('fragments_sur_la_carte')
  if (error) throw error
  return lireFragments(data)
}
