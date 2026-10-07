/**
 * QUOI     — mes énigmes côté Supabase : le compte par culture, et une culture en détail.
 * POURQUOI — deux RPC (migration 447) ; le JSON est lu par `lireMesEnigmes.ts`.
 */
import { supabase } from '@/shared/supabase/client'
import { lireMaCulture, lireMesEnigmes } from './lireMesEnigmes'

export async function fetchMesEnigmes() {
  const { data, error } = await supabase.rpc('mes_enigmes')
  if (error) throw error
  return lireMesEnigmes(data)
}

export async function fetchMaCulture(id: string) {
  const { data, error } = await supabase.rpc('mes_enigmes_culture', { p_theme: id })
  if (error) throw error
  return lireMaCulture(data)
}
