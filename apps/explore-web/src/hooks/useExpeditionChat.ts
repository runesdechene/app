import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useExpeditionsStore } from '../stores/expeditionsStore'
import { markExpeditionMessagesRead, listUpcomingExpeditions } from '../lib/expeditionsApi'
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
 *
 * V0.8.15 — la souscription Realtime mourait en silence (réseau, hibernation
 * tab, kick serveur) et le user restait avec son snapshot initial. Trois
 * filets ajoutés : subscribe AVANT fetch initial (capture les INSERT
 * pendant le SELECT, dédup côté store par id), callback de status pour
 * resync sur CLOSED/ERROR/TIMED_OUT, et listener visibilitychange (pattern
 * useCoupe) pour re-fetch au retour de focus.
 */
export function useExpeditionChat(expeditionId: string | null, trackRead = true) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!expeditionId) return
    let cancelled = false

    async function fetchAndMerge() {
      // Récupère les MAX_INITIAL DERNIERS messages (pas les premiers).
      // V0.8.16 fix : order ASC + limit 50 ne renvoyait que les 50 plus
      // anciens, donc dès qu'un voyage dépassait 50 messages les nouveaux
      // n'étaient JAMAIS rapatriés. On order DESC pour borner par les
      // récents, puis on reverse pour rendre l'ordre chronologique attendu
      // par le composant.
      const { data } = await supabase
        .from('voyage_messages')
        .select('*')
        .eq('voyage_id', expeditionId)
        .order('created_at', { ascending: false })
        .limit(MAX_INITIAL)
      if (cancelled || !data) return
      const store = useExpeditionsStore.getState()
      const existing = store.messagesByExpedition[expeditionId!] ?? []
      const fetched = data
        .map((r) => rowToMessage(r as Record<string, unknown>))
        .reverse()
      const fetchedIds = new Set(fetched.map((m) => m.id))
      // Conserve les messages live arrivés entre subscribe et fin de fetch,
      // ou les messages plus récents que la fenêtre des MAX_INITIAL derniers.
      const extras = existing.filter((m) => !fetchedIds.has(m.id))
      const merged = [...fetched, ...extras].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      )
      store.setMessages(expeditionId!, merged)
    }

    function subscribe() {
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
          const store = useExpeditionsStore.getState()
          store.addMessage(expeditionId!, rowToMessage(payload.new as Record<string, unknown>))
          if (trackRead) markExpeditionMessagesRead(expeditionId!).catch(() => {})
        },
      )
      ch.subscribe((status) => {
        // Si le channel ferme ou erre, on resync depuis la DB pour rattraper
        // ce qu'on a manqué en silence. Le store dédup par id.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (!cancelled) fetchAndMerge()
        }
      })
      channelRef.current = ch
    }

    // Ordre critique : subscribe AVANT le fetch initial. Les INSERT qui
    // arrivent pendant le SELECT sont capturés via Realtime puis dédupés
    // côté store par id (cf. expeditionsStore.addMessage).
    subscribe()
    fetchAndMerge()

    // Filet : au retour de focus (tab background → premier plan, mobile
    // OS resume), on re-fetch même si Realtime semble OK. Couvre le cas
    // où la WebSocket est tombée sans event CLOSED côté client.
    function onVisible() {
      if (document.visibilityState === 'visible' && !cancelled) {
        fetchAndMerge()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    // Mark read au mount + refresh la liste pour effacer la pastille.
    // Spectateurs (trackRead=false) : on ne touche ni aux lectures ni au badge.
    if (trackRead) {
      markExpeditionMessagesRead(expeditionId!)
        .then(() => listUpcomingExpeditions())
        .then((list) => {
          if (!cancelled) useExpeditionsStore.getState().setUpcoming(list)
        })
        .catch(() => {})
    }

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [expeditionId, trackRead])
}
