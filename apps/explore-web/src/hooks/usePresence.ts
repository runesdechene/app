import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useFogStore } from '../stores/fogStore'
import { useToastStore } from '../stores/toastStore'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface PresencePayload {
  userId: string
  name: string
  factionColor: string | null
  factionPattern: string | null
}

/**
 * Hook de présence — à appeler UNE SEULE FOIS au niveau App.
 * Rejoint un channel Supabase Presence et affiche des toasts
 * quand des joueurs arrivent sur la carte.
 */
export function usePresence() {
  const userId = useFogStore(s => s.userId)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!userId) return

    async function init() {
      const { data } = await supabase
        .from('users')
        .select('first_name, email_address, faction_id')
        .eq('id', userId!)
        .single()

      const name = data?.first_name || data?.email_address || 'Quelqu\'un'

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

      // Toast local pour soi
      addToast({
        type: 'new_user',
        message: `${name} vient de se connecter`,
        highlight: name,
        color: factionColor ?? undefined,
        iconUrl: factionPattern ?? undefined,
        timestamp: Date.now(),
      })

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
              highlight: payload.name,
              color: payload.factionColor ?? undefined,
              iconUrl: payload.factionPattern ?? undefined,
              timestamp: Date.now(),
            })
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ userId, name, factionColor, factionPattern } as PresencePayload)
          }
        })

      channelRef.current = channel
    }

    init()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [userId])
}
