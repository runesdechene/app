/**
 * QUOI     — l'état d'un Fragment pour moi, côté Supabase (`mon_fragment`, connecté seulement).
 */
import { supabase } from '@/shared/supabase/client'
import { lireMonFragment } from './lireMonFragment'

export async function fetchMonFragment(id: number) {
  const { data, error } = await supabase.rpc('mon_fragment', { p_id: id })
  if (error) throw error
  return lireMonFragment(data)
}
