/**
 * QUOI     — les Missives et ce qu'il en est advenu (hub_envois, mig 544), la plus récente en tête.
 */
import { supabase } from '@/shared/supabase/client'
import type { Liste } from './listes'

export type Statut = 'brouillon' | 'programmee' | 'en_cours' | 'envoyee'

export type Envoi = {
  id: number
  objet: string
  liste: Liste | null
  statut: Statut
  /** Partie, programmée ou écrite, selon l'état. */
  date: string
  envoyes: number
  echecs: number
  ouverts: number
  clics: number
}

export async function lireEnvois(): Promise<Envoi[]> {
  const { data, error } = await supabase.rpc('hub_envois')
  if (error) throw error
  return data as Envoi[]
}
