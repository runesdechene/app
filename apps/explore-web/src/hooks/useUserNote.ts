import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'

interface UserNote {
  text: string | null
  postedAt: string | null
}

const NOTE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * V0.7+ Hook pour éditer la propre note du user.
 * Filtre côté client si la note est expirée (> 24h) — la DB filtre aussi côté serveur (RLS / RPC).
 * Synchronise playerStore.ownNote* pour que usePresence broadcast la note dans le payload.
 */
export function useUserNote() {
  const userId = usePlayerStore(s => s.userId)
  const [note, setNote] = useState<UserNote>({ text: null, postedAt: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setNote({ text: null, postedAt: null })
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('users')
        .select('note_text, note_posted_at')
        .eq('id', userId)
        .single()
      if (cancelled) return
      if (error || !data) {
        setNote({ text: null, postedAt: null })
        usePlayerStore.getState().setOwnNote(null, null)
      } else {
        const expired = data.note_posted_at &&
          new Date(data.note_posted_at).getTime() < Date.now() - NOTE_TTL_MS
        const next = expired
          ? { text: null, postedAt: null }
          : { text: data.note_text as string | null, postedAt: data.note_posted_at as string | null }
        setNote(next)
        usePlayerStore.getState().setOwnNote(next.text, next.postedAt)
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [userId])

  const setNoteText = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (trimmed.length === 0) {
      const { error } = await supabase.rpc('clear_note')
      if (error) throw error
      setNote({ text: null, postedAt: null })
      usePlayerStore.getState().setOwnNote(null, null)
      return
    }
    if (trimmed.length > 200) throw new Error('note_too_long')
    const { data, error } = await supabase.rpc('set_note', { p_text: trimmed })
    if (error) throw error
    const postedAt = (data as { posted_at?: string } | null)?.posted_at ?? new Date().toISOString()
    setNote({ text: trimmed, postedAt })
    usePlayerStore.getState().setOwnNote(trimmed, postedAt)
  }, [])

  const clearNote = useCallback(async () => {
    const { error } = await supabase.rpc('clear_note')
    if (error) throw error
    setNote({ text: null, postedAt: null })
    usePlayerStore.getState().setOwnNote(null, null)
  }, [])

  return { note, loading, setNoteText, clearNote }
}
