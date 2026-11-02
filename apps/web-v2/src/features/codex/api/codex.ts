/**
 * QUOI     — le Codex de l'Explorateur connecté, côté Supabase.
 * POURQUOI — `mon_codex` (migration 578) rend la collection entière ; `lireCodex` la lit.
 */
import { supabase } from '@/shared/supabase/client'
import { lireCodex } from './lireCodex'

export async function fetchCodex() {
  const { data, error } = await supabase.rpc('mon_codex')
  if (error) throw error
  return lireCodex(data)
}
