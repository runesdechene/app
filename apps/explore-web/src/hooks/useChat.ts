import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useFogStore } from '../stores/fogStore'
import { useChatStore } from '../stores/chatStore'
import type { ChatMessage } from '../stores/chatStore'
import type { RealtimeChannel } from '@supabase/supabase-js'

const MAX_INITIAL = 50

function rowToMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: row.id as number,
    channel: row.channel as string,
    userId: row.user_id as string,
    userName: row.user_name as string,
    factionId: (row.faction_id as string) ?? null,
    factionColor: (row.faction_color as string) ?? null,
    factionPattern: (row.faction_pattern as string) ?? null,
    content: row.content as string,
    createdAt: row.created_at as string,
  }
}

/**
 * Hook de chat — a appeler UNE SEULE FOIS au niveau App.
 * Charge les messages recents et souscrit aux nouveaux en temps reel.
 */
export function useChat() {
  const userId = useFogStore(s => s.userId)
  const userFactionId = useFogStore(s => s.userFactionId)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!userId) return

    let cancelled = false

    const setGeneralMessages = useChatStore.getState().setGeneralMessages
    const addGeneralMessage = useChatStore.getState().addGeneralMessage
    const setFactionMessages = useChatStore.getState().setFactionMessages
    const addFactionMessage = useChatStore.getState().addFactionMessage

    async function init() {
      // 1. Charger les messages recents du canal general
      const { data: generalData } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('channel', 'general')
        .order('created_at', { ascending: true })
        .limit(MAX_INITIAL)

      if (!cancelled && generalData) {
        setGeneralMessages(generalData.map(rowToMessage))
      }

      // 2. Charger les messages faction si l'user en a une
      if (userFactionId) {
        const { data: factionData } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('channel', userFactionId)
          .order('created_at', { ascending: true })
          .limit(MAX_INITIAL)

        if (!cancelled && factionData) {
          setFactionMessages(factionData.map(rowToMessage))
        }
      }

      // 3. Nettoyage lazy des vieux messages (fire-and-forget)
      supabase.rpc('cleanup_old_chat_messages').then(() => {})

      if (cancelled) return

      // 4. Souscription Realtime avec filtres server-side
      const ch = supabase.channel('chat-realtime')

      ch.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: 'channel=eq.general',
        },
        (payload) => {
          addGeneralMessage(rowToMessage(payload.new as Record<string, unknown>))
        },
      )

      if (userFactionId) {
        ch.on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `channel=eq.${userFactionId}`,
          },
          (payload) => {
            addFactionMessage(rowToMessage(payload.new as Record<string, unknown>))
          },
        )
      }

      ch.subscribe((status) => {
        console.log('[Chat] realtime status:', status)
      })
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
  }, [userId, userFactionId])
}

/**
 * Envoyer un message chat — fonction standalone.
 * Lit le store directement via getState().
 */
export async function sendChatMessage(
  content: string,
  channelType: 'general' | 'faction',
): Promise<{ success: boolean; error?: string }> {
  const { userId, userName, userFactionId, userFactionColor, userFactionPattern } = useFogStore.getState()
  if (!userId) return { success: false, error: 'Non connecté' }

  const trimmed = content.trim()
  if (!trimmed || trimmed.length > 500) {
    return { success: false, error: 'Message invalide' }
  }

  const channel = channelType === 'general' ? 'general' : userFactionId
  if (!channel) {
    return { success: false, error: 'Aucune faction' }
  }

  const displayName = userName || 'Anonyme'

  const { data: inserted, error } = await supabase
    .from('chat_messages')
    .insert({
      channel,
      user_id: userId,
      user_name: displayName,
      faction_id: userFactionId,
      faction_color: userFactionColor,
      faction_pattern: userFactionPattern,
      content: trimmed,
    })
    .select()
    .single()

  if (error) {
    console.error('[Chat] insert error:', error)
    return { success: false, error: error.message }
  }

  // Ajout optimiste immédiat — le Realtime dédupliquera via l'id
  if (inserted) {
    const msg = rowToMessage(inserted as Record<string, unknown>)
    if (channel === 'general') {
      useChatStore.getState().addGeneralMessage(msg)
    } else {
      useChatStore.getState().addFactionMessage(msg)
    }
  }

  return { success: true }
}
