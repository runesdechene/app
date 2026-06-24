import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtimeChat, type ChatMessage } from './useRealtimeChat'
import { usePlayerStore } from '../stores/playerStore'

/**
 * Hook chat live d'une compagnie.
 *
 * - Live via useRealtimeChat (table company_messages / company_id).
 * - Fetch initial via RPC get_company_messages (50 derniers).
 * - Si companyId est null (bannière perso ou non membre) : pas d'abonnement,
 *   messages vides.
 *
 * Retourne { messages, send, loading }.
 */
export function useCompanyChat(companyId: string | null): {
  messages: ChatMessage[]
  send: (content: string) => Promise<void>
  loading: boolean
} {
  const userId = usePlayerStore((s) => s.userId)
  const [loading, setLoading] = useState(false)

  // Abonnement Realtime + fetch initial via table directe (useRealtimeChat)
  const { messages: realtimeMessages } = useRealtimeChat({
    table: 'company_messages',
    filterField: 'company_id',
    filterValue: companyId,
  })

  const send = useCallback(
    async (content: string) => {
      if (!companyId || !userId) return
      const trimmed = content.trim()
      if (!trimmed) return
      setLoading(true)
      const { data, error } = await supabase.rpc('send_company_message', {
        p_user_id: userId,
        p_company_id: companyId,
        p_content: trimmed,
      })
      setLoading(false)
      if (error) {
        console.error('[company] send_company_message error:', error.message)
        return
      }
      const result = data as { success: true; id: number } | { error: string }
      if ('error' in result) {
        console.error('[company] send_company_message métier:', result.error)
      }
    },
    [companyId, userId],
  )

  return { messages: realtimeMessages, send, loading }
}
