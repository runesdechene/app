/**
 * QUOI     — la file des énigmes signalées par les joueurs (signalements_enigme_du_hub) et la décision
 *            (traiter_signalement_enigme : accepter sa réponse, ou clore sans suite).
 * POURQUOI — les deux fonctions rendent du JSON : leur forme est celle des migrations 470, 472 et 473.
 *            Le message de la base (ses refus) remonte tel quel.
 */
import { supabase } from '@/shared/supabase/client'

export type SignalementEnigme = {
  id: number
  raison: string
  precision: string | null
  reponseDonnee: string | null
  reponseProposee: string | null
  quand: string
  enigme: { numero: number; question: string; reponse: string; variantes: string[]; format: 'qcm' | 'free' }
  qui: { id: string; nom: string }
}

export async function lireSignalementsEnigme(): Promise<SignalementEnigme[]> {
  const { data, error } = await supabase.rpc('signalements_enigme_du_hub')
  if (error) throw new Error(error.message)
  return data as SignalementEnigme[]
}

// `rendus` : les joueurs qui récupèrent leur point quand on accepte (mig 473).
export async function traiterSignalementEnigme(id: number, accepter: boolean): Promise<{ ok: boolean; rendus: number }> {
  const { data, error } = await supabase.rpc('traiter_signalement_enigme', { p_id: id, p_accepter: accepter })
  if (error) throw new Error(error.message)
  return data as { ok: boolean; rendus: number }
}
