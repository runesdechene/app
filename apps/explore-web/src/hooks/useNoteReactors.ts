import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface NoteReactor {
  emoji: string
  reactorUserId: string
  reactorName: string
  reactorAvatarUrl: string | null
  reactedAt: string
}

/**
 * V0.7+ Liste détaillée des réactions sur la note d'un user (qui + emoji + avatar).
 * Utilisé dans PlayerProfileModal pour afficher "👋 Mathéo, Pierrot…" sous la note.
 * Pour les compteurs agrégés (NoteReactionsRow sur la carte) : useNoteReactions.
 */
export function useNoteReactors(noteUserId: string | null) {
  const [reactors, setReactors] = useState<NoteReactor[]>([])

  const refetch = useCallback(async () => {
    if (!noteUserId) {
      setReactors([])
      return
    }
    const { data, error } = await supabase.rpc('get_note_reactors', { p_note_user_id: noteUserId })
    if (error || !data) {
      setReactors([])
      return
    }
    setReactors(
      (data as Array<{
        emoji: string
        reactor_user_id: string
        reactor_name: string | null
        reactor_avatar_url: string | null
        reacted_at: string
      }>).map(r => ({
        emoji: r.emoji,
        reactorUserId: r.reactor_user_id,
        reactorName: r.reactor_name ?? 'Quelqu\'un',
        reactorAvatarUrl: r.reactor_avatar_url,
        reactedAt: r.reacted_at,
      })),
    )
  }, [noteUserId])

  useEffect(() => { void refetch() }, [refetch])

  return { reactors, refetch }
}
