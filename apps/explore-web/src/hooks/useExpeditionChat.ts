import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useExpeditionsStore } from '../stores/expeditionsStore'
import type { ExpeditionMessage } from '../types/expedition'
import type { RealtimeChannel } from '@supabase/supabase-js'

const MAX_INITIAL = 50

function rowToMessage(row: Record<string, unknown>): ExpeditionMessage {
  return {
    id: row.id as number,
    expedition_id: row.voyage_id as string,
    user_id: row.user_id as string,
    content: row.content as string,
    created_at: row.created_at as string,
  }
}

/**
 * Hook chat live d'une expédition. À appeler quand la modale ouvre.
 * Pattern aligné sur useChat.ts mais filtré par voyage_id.
 */
export function useExpeditionChat(expeditionId: string | null) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!expeditionId) return
    let cancelled = false

    const setMessages = useExpeditionsStore.getState().setMessages
    const addMessage = useExpeditionsStore.getState().addMessage

    async function init() {
      // Charge les messages initiaux
      const { data } = await supabase
        .from('voyage_messages')
        .select('*')
        .eq('voyage_id', expeditionId)
        .order('created_at', { ascending: true })
        .limit(MAX_INITIAL)

      if (cancelled || !data) return

      setMessages(expeditionId!, data.map((r) => rowToMessage(r as Record<string, unknown>)))

      // Souscription Realtime sur les nouveaux messages de cette expé
      const ch = supabase.channel(`expedition-chat:${expeditionId}`)
      ch.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'voyage_messages',
          filter: `voyage_id=eq.${expeditionId}`,
        },
        (payload) => {
          addMessage(expeditionId!, rowToMessage(payload.new as Record<string, unknown>))
        },
      )
      ch.subscribe()
      channelRef.current = ch
    }

    init()

    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [expeditionId])
}
