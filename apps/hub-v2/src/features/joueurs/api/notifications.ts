/**
 * QUOI     — lit le tableau de bord des notifications (notifications_du_hub) : abonnés, sortes vues sur 30 jours, fil.
 * POURQUOI — la RPC est gardée par _is_admin(). On lui passe les sortes que le catalogue connaît (p_types, pour
 *            la cloche) et celles qui partent vraiment (p_fil, pour que le fil ne soit pas noyé de silencieuses).
 */
import { supabase } from '@/shared/supabase/client'
import { typesConnus, typesQuiPartent } from '../lib/catalogue'

export type ChiffresSorte = { type: string; semaine: number; mois: number; derniere: string | null; cloche: boolean }
export type LigneDuFil = { id: number; type: string; quand: string; lu: boolean; pour: string | null; qui: string | null; sur: string | null }
export type VueNotifications = { abonnes: number; cloche: string[]; sortes: ChiffresSorte[]; fil: LigneDuFil[] }

export async function lireNotificationsDuHub(): Promise<VueNotifications> {
  const { data, error } = await supabase.rpc('notifications_du_hub', { p_types: typesConnus(), p_fil: typesQuiPartent() })
  if (error) throw new Error(error.message)
  return data as VueNotifications
}
