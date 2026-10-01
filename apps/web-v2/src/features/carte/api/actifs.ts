/**
 * QUOI     — les Actifs de la carte (migration 402).
 * POURQUOI — la base les rend déjà brouillés : la vraie position d'un Explorateur qui brouille ses
 *            pistes n'arrive jamais jusqu'ici.
 */
import { supabase } from '@/shared/supabase/client'
import { lireActifs } from './lireActifs'

export async function fetchActifs() {
  const { data, error } = await supabase.rpc('actifs_carte')
  if (error) throw error
  return lireActifs(data)
}
