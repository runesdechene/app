import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtimeChat, type ChatMessage } from './useRealtimeChat'
import { usePlayerStore } from '../stores/playerStore'

/**
 * Hook chat live d'une Compagnie.
 *
 * Le chat de Compagnie est un CANAL du chat global : `chat_messages` avec
 * `channel = <companyId>` (comme le Dortoir = `channel = <factionId>`). Du coup
 * il est aussi accessible depuis l'onglet Tchat — c'est le même canal, répété.
 *
 * - Live + fetch initial via useRealtimeChat (table chat_messages / channel).
 * - Envoi : insert direct dans chat_messages (pattern du chat existant).
 * - companyId null → pas d'abonnement, messages vides.
 *
 * Retourne { messages, send, loading }.
 */
export function useCompanyChat(companyId: string | null): {
  messages: ChatMessage[]
  send: (content: string) => Promise<void>
  loading: boolean
} {
  const [loading, setLoading] = useState(false)

  const { messages } = useRealtimeChat({
    table: 'chat_messages',
    filterField: 'channel',
    filterValue: companyId,
  })

  const send = useCallback(
    async (content: string) => {
      if (!companyId) return
      const trimmed = content.trim()
      if (!trimmed || trimmed.length > 500) return
      const { userId, userName, userFactionId, userFactionColor, userFactionPattern } =
        usePlayerStore.getState()
      if (!userId) return
      setLoading(true)
      const { error } = await supabase.from('chat_messages').insert({
        channel: companyId,
        user_id: userId,
        user_name: userName || 'Anonyme',
        faction_id: userFactionId,
        faction_color: userFactionColor,
        faction_pattern: userFactionPattern,
        content: trimmed,
      })
      setLoading(false)
      if (error) console.error('[company] send chat error:', error.message)
    },
    [companyId],
  )

  return { messages, send, loading }
}
