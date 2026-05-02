import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import { useToastStore } from '../stores/toastStore'
import { usePlayersStore } from '../stores/playersStore'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface PresencePayload {
  userId: string
  name: string
  factionColor: string | null
  factionPattern: string | null
  avatarUrl: string | null
  displayedTitles: string[]
  lat: number | null
  lng: number | null
}

const TRACK_INTERVAL_MS = 10_000

function buildPayload(userId: string): PresencePayload {
  const state = usePlayerStore.getState()
  // V0.7+ Brouillage GPS — si toggle on et position floutée prête, on broadcast la floutée.
  // Sinon on broadcast la vraie. Soi continue d'afficher sa vraie position (publicPosition
  // n'est consommée QUE dans le payload presence — donc visible uniquement aux autres).
  const pos = (state.brouillerPistes && state.publicPosition)
    ? state.publicPosition
    : state.userPosition
  return {
    userId,
    name: state.userName || 'Quelqu\'un',
    factionColor: state.userFactionColor,
    factionPattern: state.userFactionPattern,
    avatarUrl: state.userAvatarUrl,
    displayedTitles: state.displayedTitles,
    lat: pos?.lat ?? null,
    lng: pos?.lng ?? null,
  }
}

/**
 * Hook de présence — à appeler UNE SEULE FOIS au niveau App.
 *
 * V0.7+ La note éphémère N'EST PAS dans le payload presence : elle se propage
 * exclusivement via `useNotesRealtime` (postgres_changes UPDATE sur `users`,
 * mig 057). Mélanger les deux sources causait deux bugs : (1) la position
 * publique sautait à chaque édit de note (re-track presence), (2) la note
 * disparaissait chez les autres si le sync handler arrivait avant le UPDATE
 * realtime (le `?? null` écrasait la valeur).
 */
export function usePresence() {
  const userId = usePlayerStore(s => s.userId)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!userId) return

    async function init() {
      const addToast = useToastStore.getState().addToast
      const { setPlayer, removePlayer } = usePlayersStore.getState()

      const channel = supabase.channel('map-presence', {
        config: { presence: { key: userId! } },
      })

      channel
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          for (const p of newPresences) {
            const payload = p as unknown as PresencePayload
            if (payload.userId === userId) continue
            addToast({
              type: 'new_user',
              message: `${payload.name} vient de se connecter`,
              highlights: [payload.name],
              actorId: payload.userId,
              actorAvatarUrl: payload.avatarUrl ?? undefined,
              color: payload.factionColor ?? undefined,
              iconUrl: payload.factionPattern ?? undefined,
              timestamp: Date.now(),
            })
            if (payload.lat != null && payload.lng != null) {
              // V0.7+ Note non touchée : preserve l'existante (mise à jour par useNotesRealtime).
              const existing = usePlayersStore.getState().players.get(payload.userId)
              setPlayer({
                userId: payload.userId,
                name: payload.name,
                position: { lng: payload.lng, lat: payload.lat },
                factionColor: payload.factionColor,
                factionPattern: payload.factionPattern,
                avatarUrl: payload.avatarUrl,
                displayedTitles: Array.isArray(payload.displayedTitles) ? payload.displayedTitles : [],
                lastSeen: Date.now(),
                noteText: existing?.noteText ?? null,
                notePostedAt: existing?.notePostedAt ?? null,
              })
            }
          }
        })
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState()
          for (const [key, presences] of Object.entries(state)) {
            if (key === userId) continue
            const raw = presences[0] as Record<string, unknown>
            const lat = raw.lat as number | null
            const lng = raw.lng as number | null
            if (lat == null || lng == null) continue
            // V0.7+ Note non touchée : preserve l'existante (mise à jour par useNotesRealtime).
            const existingSync = usePlayersStore.getState().players.get(raw.userId as string)
            setPlayer({
              userId: raw.userId as string,
              name: raw.name as string,
              position: { lng, lat },
              factionColor: (raw.factionColor as string) ?? null,
              factionPattern: (raw.factionPattern as string) ?? null,
              avatarUrl: (raw.avatarUrl as string) ?? null,
              displayedTitles: Array.isArray(raw.displayedTitles) ? (raw.displayedTitles as string[]) : [],
              lastSeen: Date.now(),
              noteText: existingSync?.noteText ?? null,
              notePostedAt: existingSync?.notePostedAt ?? null,
            })
          }
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          for (const p of leftPresences) {
            const payload = p as unknown as PresencePayload
            if (payload.userId === userId) continue
            removePlayer(payload.userId)
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track(buildPayload(userId!))
          }
        })

      intervalRef.current = setInterval(async () => {
        if (channel.state === 'joined') {
          await channel.track(buildPayload(userId!))
        }
      }, TRACK_INTERVAL_MS)

      channelRef.current = channel
    }

    init()

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      usePlayersStore.getState().clearAll()
    }
  }, [userId])
}
