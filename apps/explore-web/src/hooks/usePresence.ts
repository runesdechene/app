import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import { useToastStore } from '../stores/toastStore'
import { usePlayersStore } from '../stores/playersStore'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface PresenceTitle {
  icon: string
  name: string
}

interface PresencePayload {
  userId: string
  name: string
  factionColor: string | null
  factionPattern: string | null
  avatarUrl: string | null
  displayedTitles: PresenceTitle[]
  composedPhrase: string | null
  lat: number | null
  lng: number | null
}

const TRACK_INTERVAL_MS = 10_000 // Re-track position toutes les 10s

/**
 * Hook de présence — à appeler UNE SEULE FOIS au niveau App.
 * Rejoint un channel Supabase Presence, affiche des toasts
 * quand des joueurs arrivent, et synchronise les positions.
 */
export function usePresence() {
  const userId = usePlayerStore(s => s.userId)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!userId) return

    async function init() {
      const { data } = await supabase
        .from('users')
        .select('first_name, faction_id')
        .eq('id', userId!)
        .single()

      const name = data?.first_name || 'Quelqu\'un'

      let factionColor: string | null = null
      let factionPattern: string | null = null

      if (data?.faction_id) {
        const { data: faction } = await supabase
          .from('factions')
          .select('color, pattern')
          .eq('id', data.faction_id)
          .single()
        if (faction) {
          factionColor = faction.color
          factionPattern = faction.pattern ?? null
        }
      }

      const addToast = useToastStore.getState().addToast
      const { setPlayer, removePlayer } = usePlayersStore.getState()

      function buildPayload(): PresencePayload {
        const state = usePlayerStore.getState()
        const pos = state.userPosition
        const avatar = state.userAvatarUrl
        // Construire les titres affiches
        const titles: PresenceTitle[] = []
        const { unlockedGeneralTitles, displayedGeneralTitleIds, factionTitle2, composedPhrase } = state
        for (const id of displayedGeneralTitleIds) {
          const t = unlockedGeneralTitles.find(tt => tt.id === id)
          if (t) titles.push({ icon: t.icon, name: t.name })
        }
        if (factionTitle2) titles.push({ icon: factionTitle2.icon, name: factionTitle2.name })
        return {
          userId: userId!,
          name,
          factionColor,
          factionPattern,
          avatarUrl: avatar,
          displayedTitles: titles,
          composedPhrase,
          lat: pos?.lat ?? null,
          lng: pos?.lng ?? null,
        }
      }

      // Rejoindre le channel presence
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
              color: payload.factionColor ?? undefined,
              iconUrl: payload.factionPattern ?? undefined,
              timestamp: Date.now(),
            })
            if (payload.lat != null && payload.lng != null) {
              setPlayer({
                userId: payload.userId,
                name: payload.name,
                position: { lng: payload.lng, lat: payload.lat },
                factionColor: payload.factionColor,
                factionPattern: payload.factionPattern,
                avatarUrl: payload.avatarUrl,
                displayedTitles: (payload.displayedTitles as PresenceTitle[]) ?? [],
                composedPhrase: (payload.composedPhrase as string) ?? null,
                lastSeen: Date.now(),
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
            setPlayer({
              userId: raw.userId as string,
              name: raw.name as string,
              position: { lng, lat },
              factionColor: (raw.factionColor as string) ?? null,
              factionPattern: (raw.factionPattern as string) ?? null,
              avatarUrl: (raw.avatarUrl as string) ?? null,
              displayedTitles: (raw.displayedTitles as PresenceTitle[]) ?? [],
              composedPhrase: (raw.composedPhrase as string) ?? null,
              lastSeen: Date.now(),
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
            await channel.track(buildPayload())
          }
        })

      // Re-track position périodiquement
      intervalRef.current = setInterval(async () => {
        if (channel.state === 'joined') {
          await channel.track(buildPayload())
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
