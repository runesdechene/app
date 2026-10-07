/**
 * QUOI     — les énigmes de la carte côté Supabase : celles qui m'attendent, en ouvrir une, y répondre.
 * POURQUOI — trois RPC (migration 441) ; le JSON est lu par `lireEnigmes.ts`.
 */
import { supabase } from '@/shared/supabase/client'
import { lireEnAttente, lireOuverture, lireVerdict } from './lireEnigmes'

export async function fetchEnigmesEnAttente() {
  const { data, error } = await supabase.rpc('enigmes_en_attente')
  if (error) throw error
  return lireEnAttente(data)
}

export async function ouvrirEnigme(id: number) {
  const { data, error } = await supabase.rpc('ouvrir_enigme', { p_eveil: id })
  if (error) throw error
  return lireOuverture(data)
}

export async function percerEnigme(id: number, reponse: string) {
  const { data, error } = await supabase.rpc('percer_enigme', { p_eveil: id, p_reponse: reponse })
  if (error) throw error
  return lireVerdict(data)
}
