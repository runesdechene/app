import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNotificationStore, Notification } from '../stores/notificationStore'
import { usePlayerStore } from '../stores/playerStore'

/**
 * Une notif perso est "self" quand son acteur (data.actorId) c'est toi.
 * Sémantique : tu viens de faire l'action, c'est inutile de te la notifier.
 * Couvre place_taken_remote_self, place_reaffirmed et tout autre trigger
 * qui s'enverrait à lui-même via actorId.
 *
 * Exception : mecene_principal_gained — tu peux ne pas avoir su que ta
 * dernière mise faisait basculer le top1 (le score adverse n'est pas
 * forcément visible), donc l'info de bascule reste utile.
 */
function isSelfNotification(
  notif: { type: string; data: Record<string, unknown> | null | undefined },
  currentUserId: string,
): boolean {
  if (notif.type === 'mecene_principal_gained') return false
  const actorId = (notif.data as { actorId?: string } | null | undefined)?.actorId
  return actorId === currentUserId
}

export function useNotifications() {
  const userId = usePlayerStore((s) => s.userId)
  const setNotifications = useNotificationStore((s) => s.setNotifications)
  const addNotification = useNotificationStore((s) => s.addNotification)
  const updateNotification = useNotificationStore((s) => s.updateNotification)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!userId) return

    // Fetch initial notifications
    async function fetchNotifications() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (data) {
        const mapped = data.map((row) => ({
          id: row.id,
          type: row.type,
          data: row.data,
          read: row.read,
          created_at: row.created_at,
        })) as Notification[]
        setNotifications(mapped.filter((n) => !isSelfNotification(n, userId!)))
      }
    }

    fetchNotifications()

    // Realtime subscription
    const ch = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: number
            type: string
            data: Record<string, unknown>
            read: boolean
            created_at: string
          }
          if (isSelfNotification(row, userId!)) return
          addNotification({
            id: row.id,
            type: row.type as Notification['type'],
            data: row.data as Notification['data'],
            read: row.read,
            created_at: row.created_at,
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: number
            type: string
            data: Record<string, unknown>
            read: boolean
            created_at: string
          }
          updateNotification({
            id: row.id,
            type: row.type as Notification['type'],
            data: row.data as Notification['data'],
            read: row.read,
            created_at: row.created_at,
          })
        }
      )

    ch.subscribe()
    channelRef.current = ch

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [userId, setNotifications, addNotification, updateNotification])
}
