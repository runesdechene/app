import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import { usePlayersStore } from '../stores/playersStore'

/**
 * V0.7+ Filet de sécurité pour la propagation des notes en temps réel.
 *
 * Le canal Supabase Presence broadcast déjà les notes via payload (cf. usePresence),
 * mais on a observé des cas où la modif sur compte A n'arrivait pas immédiatement sur
 * compte B (cache presence, timing). Cette subscription postgres_changes sur public.users
 * (filtrée par migration 057 sur les colonnes id, note_text, note_posted_at) garantit
 * que toute modif de note d'un voyageur déjà présent dans playersStore est reflétée.
 */
export function useNotesRealtime() {
  const myUserId = usePlayerStore(s => s.userId)

  useEffect(() => {
    if (!myUserId) return
    const channel = supabase.channel(`notes-realtime:${myUserId}`)
    channel
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users' },
        (payload) => {
          const row = payload.new as {
            id?: string
            note_text?: string | null
            note_posted_at?: string | null
          }
          if (!row.id || row.id === myUserId) return  // ma propre note est gérée par useUserNote
          const players = usePlayersStore.getState()
          const player = players.players.get(row.id)
          if (!player) return  // voyageur pas (encore) en presence chez moi
          players.setPlayer({
            ...player,
            noteText: row.note_text ?? null,
            notePostedAt: row.note_posted_at ?? null,
          })
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [myUserId])
}
