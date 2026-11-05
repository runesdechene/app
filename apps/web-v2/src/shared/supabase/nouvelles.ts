/**
 * QUOI     — l'accord aux nouvelles de Runes de Chêne (les Missives) : le lire, le donner.
 * POURQUOI — il se donne en signant la Charte ou depuis l'invitation aux notifications, et vaut
 *            +2 à la jauge d'énergie tant qu'il tient (mig 586, Uriel 05/11).
 */
import { supabase } from '@/shared/supabase/client'

export async function lireAccordNouvelles(): Promise<boolean> {
  const { data, error } = await supabase.rpc('mon_accord_nouvelles')
  if (error) throw error
  return data
}

export async function donnerAccordNouvelles() {
  const { error } = await supabase.rpc('donner_accord_nouvelles', { p_accord: true })
  if (error) throw error
}
