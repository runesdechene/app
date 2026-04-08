import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNotificationStore, Notification } from '../stores/notificationStore'
import { usePlayerStore } from '../stores/playerStore'

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
        setNotifications(
          data.map((row) => ({
            id: row.id,
            type: row.type,
            data: row.data,
            read: row.read,
            created_at: row.created_at,
          })) as Notification[]
        )
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
