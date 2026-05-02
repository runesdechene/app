import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'

const NOTE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * V0.7+ Hook pour la note du moment.
 *
 * Le store playerStore.ownNote* est la source de vérité unique : usePresence le lit
 * pour broadcast aux autres voyageurs, et la NoteBubble propre le lit pour s'afficher.
 * Plusieurs instances de ce hook peuvent co-exister (MapPage globale, modale profile,
 * popover NoteEditor) sans race condition — toutes pointent sur le même store.
 *
 * setNoteText / clearNote font de l'optimistic update : le store passe à la nouvelle
 * valeur AVANT le RPC, ce qui (a) déclenche immédiatement le re-track presence,
 * (b) évite la fenêtre où les autres voyageurs voient la note disparaître pendant
 * la requête. Si le RPC échoue, on rollback.
 */
export function useUserNote() {
  const userId = usePlayerStore(s => s.userId)
  const text = usePlayerStore(s => s.ownNoteText)
  const postedAt = usePlayerStore(s => s.ownNotePostedAt)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
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
      // Si fetch échoue, on PRÉSERVE ce qui est dans le store (une autre instance peut
      // avoir déjà set la valeur correcte). On n'écrase qu'avec une donnée valide.
      if (!error && data) {
        const expired = data.note_posted_at &&
          new Date(data.note_posted_at).getTime() < Date.now() - NOTE_TTL_MS
        if (expired) {
          usePlayerStore.getState().setOwnNote(null, null)
        } else {
          usePlayerStore.getState().setOwnNote(
            (data.note_text as string | null) ?? null,
            (data.note_posted_at as string | null) ?? null,
          )
        }
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [userId])

  return { note: { text, postedAt }, loading, setNoteText, clearNote }
}

/** Pose ou modifie la note. Optimistic + rollback si RPC échoue. */
export async function setNoteText(value: string): Promise<void> {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    await clearNote()
    return
  }
  if (trimmed.length > 200) throw new Error('note_too_long')
  const prevText = usePlayerStore.getState().ownNoteText
  const prevPostedAt = usePlayerStore.getState().ownNotePostedAt
  const optimisticPostedAt = new Date().toISOString()
  // Optimistic : le store passe à la nouvelle valeur tout de suite. Le useEffect dans
  // usePresence détecte le changement et re-track immédiatement → autres voyageurs voient
  // la nouvelle note sans fenêtre intermédiaire à null.
  usePlayerStore.getState().setOwnNote(trimmed, optimisticPostedAt)
  const { data, error } = await supabase.rpc('set_note', { p_text: trimmed })
  if (error) {
    // Rollback
    usePlayerStore.getState().setOwnNote(prevText, prevPostedAt)
    throw error
  }
  // Sync du timestamp serveur (la note posée_at de l'optimistic peut différer de quelques ms)
  const serverPostedAt = (data as { posted_at?: string } | null)?.posted_at ?? optimisticPostedAt
  usePlayerStore.getState().setOwnNote(trimmed, serverPostedAt)
}

/** Efface la note. Optimistic + rollback si RPC échoue. */
export async function clearNote(): Promise<void> {
  const prevText = usePlayerStore.getState().ownNoteText
  const prevPostedAt = usePlayerStore.getState().ownNotePostedAt
  usePlayerStore.getState().setOwnNote(null, null)
  const { error } = await supabase.rpc('clear_note')
  if (error) {
    usePlayerStore.getState().setOwnNote(prevText, prevPostedAt)
    throw error
  }
}
