/**
 * QUOI     — le calendrier de l'Explorateur connecté : le lire, le choisir.
 * POURQUOI — `users.calendrier` (mig 475). `set_calendrier` est à part : `set_my_preference` ne
 *            prend que des booléens. Partagé : l'onboarding, les Préférences et chaque écran qui
 *            affiche une date s'en servent.
 * ATTENTION — sans compte, `get_my_preferences` ne renvoie rien : `objet` lève, et l'appelant
 *            retombe sur le chrétien.
 */
import { estCalendrier, type Calendrier } from '@runes/calendrier'
import { supabase } from '@/shared/supabase/client'
import { objet } from './lire'

export async function lireCalendrier(): Promise<Calendrier> {
  const { data, error } = await supabase.rpc('get_my_preferences')
  if (error) throw error
  const calendrier = objet(data).calendrier
  return estCalendrier(calendrier) ? calendrier : 'chretien'
}

export async function reglerCalendrier(calendrier: Calendrier): Promise<void> {
  const { data, error } = await supabase.rpc('set_calendrier', { p_calendrier: calendrier })
  if (error) throw error
  if ('error' in objet(data)) throw new Error('calendrier refusé')
}
