import { useEffect, useState } from 'react'
import { useToastStore } from '../stores/toastStore'
import { usePlayerStore } from '../stores/playerStore'
import { safeStorage } from '../lib/safeStorage'

const SEEN_KEY = 'activity_last_seen_at'

/**
 * Compte les activités publiques (toasts du toastStore) plus récentes que
 * la dernière visite de la page /activite. Stocké en localStorage.
 *
 * Distinct de useNotificationStore.unreadCount() qui concerne les notifs
 * personnelles (mécène, milestones, expedition_message, etc.).
 *
 * Exclut les actions du user lui-même : loadRecentActivityToasts replay
 * ses propres actions au boot (V070, persistance voulue) et useCourt-
 * Notifications réémet ses propres events Cour en live — sans ce filtre,
 * chaque entrée sur la carte affichait une pastille pour ses propres
 * actions, ce qui n'a pas de sens.
 */
export function useUnreadActivityCount(): number {
  const toasts = useToastStore((s) => s.toasts)
  const currentUserId = usePlayerStore((s) => s.userId)
  const [seenAt, setSeenAt] = useState<number>(() => {
    const raw = safeStorage.get(SEEN_KEY)
    const parsed = raw ? Number(raw) : 0
    return Number.isFinite(parsed) ? parsed : 0
  })

  // Re-lire le storage quand un autre composant marque comme lu (cross-component sync)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== SEEN_KEY) return
      const parsed = e.newValue ? Number(e.newValue) : 0
      setSeenAt(Number.isFinite(parsed) ? parsed : 0)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return toasts.filter((t) => t.timestamp > seenAt && t.actorId !== currentUserId).length
}

/** Marquer toute l'activité comme lue (à appeler en entrant sur /activite). */
export function markActivitySeen(): void {
  const now = Date.now()
  safeStorage.set(SEEN_KEY, String(now))
  // Force un dispatch storage pour les autres tabs/composants
  try {
    window.dispatchEvent(new StorageEvent('storage', {
      key: SEEN_KEY,
      newValue: String(now),
    }))
  } catch {
    // ignore
  }
}
