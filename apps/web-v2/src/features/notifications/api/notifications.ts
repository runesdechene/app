/**
 * QUOI     — les Notifications (migration 386) : les lire, les compter, les marquer lues, les
 *            écouter arriver.
 * POURQUOI — la base ne rend que les sortes qui ont un sens en V2 ; chaque fonction lit
 *            `auth.uid()` : on n'envoie jamais qui on est.
 */
import { nombre } from '@/shared/lib/lire'
import { supabase } from '@/shared/supabase/client'
import { lireNotifications } from './lireNotifications'

export async function fetchNotifications() {
  const { data, error } = await supabase.rpc('mes_notifications')
  if (error) throw error
  return lireNotifications(data)
}

export async function fetchNonLues() {
  const { data, error } = await supabase.rpc('notifications_non_lues')
  if (error) throw error
  return nombre(data)
}

export async function marquerLues() {
  const { error } = await supabase.rpc('marquer_notifications_lues')
  if (error) throw error
}

// Une notification qui arrive (les règles de la table ne montrent que les miennes). Le passage à
// « lu » ne compte pas : la liste ouverte garde son rose le temps de la visite.
export function ecouterNotifications(changement: () => void): () => void {
  const canal = supabase
    .channel(`notifications-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications' },
      changement,
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(canal)
  }
}
