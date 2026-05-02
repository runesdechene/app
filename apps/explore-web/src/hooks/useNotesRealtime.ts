import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import { usePlayersStore } from '../stores/playersStore'

const NOTE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * V0.7+ Source de vérité unique pour les notes des autres voyageurs : la DB.
 *
 * Le canal presence n'est plus la source autoritative pour les notes (il continue de
 * propager le payload pour l'initial join, mais ses valeurs peuvent être stales si
 * l'auteur a multiple connexions ou si Supabase Realtime cache mal).
 *
 * Stratégie ici :
 *   1. Au mount + à chaque ajout de player dans playersStore : fetch la note depuis users
 *      (via SELECT direct REST) → garanti à jour avec ce qui est en DB.
 *   2. postgres_changes UPDATE filtré (mig 057) → updates live quand un user modifie sa note.
 *
 * Conséquence : la note affichée sous l'avatar d'un autre voyageur reflète TOUJOURS
 * l'état exact de la DB (avec un délai max de ~300ms après la modif).
 */
export function useNotesRealtime() {
  const myUserId = usePlayerStore(s => s.userId)
  // On regarde la Map des players ; toute modif (add/remove) re-déclenche le useEffect.
  const players = usePlayersStore(s => s.players)
  const fetchedSetRef = useRef<Set<string>>(new Set())

  // Fetch initial des notes pour les players nouvellement présents
  useEffect(() => {
    if (!myUserId) return
    const fetched = fetchedSetRef.current
    const toFetch: string[] = []
    for (const userId of players.keys()) {
      if (userId === myUserId) continue
      if (fetched.has(userId)) continue
      toFetch.push(userId)
    }
    if (toFetch.length === 0) return

    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, note_text, note_posted_at')
        .in('id', toFetch)
      if (cancelled || error || !data) return
      const playersStore = usePlayersStore.getState()
      const now = Date.now()
      for (const row of data as Array<{ id: string; note_text: string | null; note_posted_at: string | null }>) {
        fetched.add(row.id)
        const player = playersStore.players.get(row.id)
        if (!player) continue
        const expired = row.note_posted_at && new Date(row.note_posted_at).getTime() < now - NOTE_TTL_MS
        playersStore.setPlayer({
          ...player,
          noteText: expired ? null : row.note_text,
          notePostedAt: expired ? null : row.note_posted_at,
        })
      }
    })()
    return () => { cancelled = true }
  }, [myUserId, players])

  // Live updates via postgres_changes
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
          if (!row.id || row.id === myUserId) return
          const playersStore = usePlayersStore.getState()
          const player = playersStore.players.get(row.id)
          if (!player) return
          // Mark as fetched (cohérence avec le fetch initial — évite re-fetch inutile)
          fetchedSetRef.current.add(row.id)
          playersStore.setPlayer({
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
