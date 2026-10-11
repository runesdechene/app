/**
 * QUOI     — les conditions acceptées par le compte (mig 498) : laquelle, et les accepter.
 * POURQUOI — l'inscription (étape Charte) et la fenêtre « Nos conditions évoluent » les écrivent
 *            de la même façon ; la base garde la version et la date (preuve du consentement).
 */
import { supabase } from './client'

export async function mesConditions(): Promise<string | null> {
  const { data, error } = await supabase.rpc('mes_conditions')
  if (error) throw error
  return data
}

export async function accepterConditions(version: string): Promise<void> {
  const { error } = await supabase.rpc('accepter_conditions', { p_version: version })
  if (error) throw error
}
