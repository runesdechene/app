/**
 * QUOI     — le récit d'un Fragment côté Supabase.
 * POURQUOI — une RPC ouverte à tous (migration 459) ; le JSON est lu par `lireRecit.ts`.
 */
import { supabase } from '@/shared/supabase/client'
import { lireRecit } from './lireRecit'

export async function fetchRecit(id: number) {
  const { data, error } = await supabase.rpc('recit_du_fragment', { p_id: id })
  if (error) throw error
  return lireRecit(data)
}
