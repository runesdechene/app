/**
 * QUOI     — les énigmes de la carte côté Supabase : celles qui m'attendent, en ouvrir une, y répondre.
 * POURQUOI — quatre RPC (migrations 441, 470) ; le JSON est lu par `lireEnigmes.ts`.
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

export type RaisonEnigme = 'reponse_refusee' | 'erreur' | 'autre'

// Signaler une énigme (mig 470) : la base relève elle-même ma dernière réponse.
export async function signalerEnigme(numero: number, raison: RaisonEnigme, precision: string) {
  const { error } = await supabase.rpc('signaler_enigme', {
    p_enigme: numero,
    p_raison: raison,
    p_precision: precision,
  })
  if (error) throw error
}
