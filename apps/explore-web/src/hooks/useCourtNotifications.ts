import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import { useToastStore } from '../stores/toastStore'
import { COURT_TYPES, buildCourtToast, type CourtActivityRow } from '../lib/courtToastMessages'

// V0.7 phase 5 — Subscribe Realtime sur les types Cour de activity_log.
// Pour la persistance au reload, voir loadRecentActivityToasts qui replay
// les events des 7 derniers jours via le même helper buildCourtToast().

interface ActivityLogRow extends CourtActivityRow {
  id: number
  created_at: string
}

export function useCourtNotifications() {
  const userId = usePlayerStore(s => s.userId)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!userId) return

    const ch = supabase.channel(`court-notif-${userId}`)
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_log' },
      (payload) => {
        const row = payload.new as ActivityLogRow
        if (!COURT_TYPES.has(row.type)) return
        const t = buildCourtToast(row, userId)
        if (!t) return
        useToastStore.getState().addToast({
          type: 'court',
          message: t.message,
          highlights: t.highlights,
          actorId: row.actor_id ?? undefined,
          placeId: row.place_id ?? undefined,
          timestamp: Date.now(),
        })
      },
    )
    ch.subscribe()
    channelRef.current = ch

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [userId])
}
