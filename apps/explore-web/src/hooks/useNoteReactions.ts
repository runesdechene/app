import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface ReactionCount {
  emoji: string
  count: number
}

/**
 * V0.7+ Compteurs agrégés des réactions sur la note d'un user.
 * Le filtrage 24h est déjà fait côté serveur (RPC get_note_reactions).
 * Pas de subscribe realtime pour V0.7+ — refetch manuel suffit (toast / refresh / blur).
 */
export function useNoteReactions(noteUserId: string | null) {
  const [reactions, setReactions] = useState<ReactionCount[]>([])

  const refetch = useCallback(async () => {
    if (!noteUserId) {
      setReactions([])
      return
    }
    const { data, error } = await supabase.rpc('get_note_reactions', { p_note_user_id: noteUserId })
    if (error || !data) {
      setReactions([])
      return
    }
    setReactions(
      (data as Array<{ emoji: string; count: number | string }>).map(r => ({
        emoji: r.emoji,
        count: Number(r.count),
      })),
    )
  }, [noteUserId])

  useEffect(() => { void refetch() }, [refetch])

  const addReaction = useCallback(async (targetUserId: string, emoji: string) => {
    const { error } = await supabase.rpc('react_to_note', {
      p_note_user_id: targetUserId,
      p_emoji: emoji,
    })
    if (error) throw error
    if (targetUserId === noteUserId) await refetch()
  }, [noteUserId, refetch])

  return { reactions, refetch, addReaction }
}
