/**
 * QUOI     — mes titres (migration 430).
 */
import { supabase } from '@/shared/supabase/client'
import { lireMesTitres } from './lireMesTitres'

export async function fetchMesTitres() {
  const { data, error } = await supabase.rpc('get_mes_titres')
  if (error) throw error
  return lireMesTitres(data)
}
