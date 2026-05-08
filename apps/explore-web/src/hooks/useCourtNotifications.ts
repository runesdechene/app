import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import { useToastStore } from '../stores/toastStore'
import { useVictoryModalStore } from '../stores/victoryModalStore'
import { pushVeilleOverride } from '../lib/loadInitialVeilles'
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

        // V0.7.6 (8/05) — bascule de lieu : update temps réel de la carte
        // (couleur, faction, nom du nouveau veilleur) via pushVeilleOverride.
        // Les data du log sont enrichis depuis mig 133 avec factionId,
        // factionColor, factionPattern, isNeutral, members[].
        if (row.type === 'place_taken_remote' || row.type === 'place_taken_remote_self') {
          const data = row.data as {
            placeId?: string
            placeTitle?: string
            actorName?: string
            factionId?: string | null
            factionColor?: string | null
            isNeutral?: boolean
            members?: Array<{ userId: string; displayName: string; avatarUrl: string | null }>
          } | undefined
          if (data?.placeId && Array.isArray(data.members)) {
            pushVeilleOverride(
              data.placeId,
              data.factionId ?? null,
              data.isNeutral ?? false,
              data.members,
            )
          }
          // Pop-up Victoire si c'est moi qui ai pris (only on _self)
          if (row.type === 'place_taken_remote_self' && row.actor_id === userId && data?.placeTitle) {
            const fromVacant = (row.data as { fromVacant?: boolean } | undefined)?.fromVacant === true
            useVictoryModalStore.getState().show({
              placeTitle: data.placeTitle,
              fromVacant,
              factionColor: data.factionColor ?? null,
            })
          }
        }

        const t = buildCourtToast(row, userId)
        if (!t) return
        useToastStore.getState().addToast({
          type: 'court',
          message: t.message,
          highlights: t.highlights,
          // V097.1 — actorId mappé seulement si l'actor est en highlights[0],
          // sinon le clic sur le lieu serait redirigé vers le profil de l'actor.
          actorId: t.hasActorInHighlights ? (row.actor_id ?? undefined) : undefined,
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
