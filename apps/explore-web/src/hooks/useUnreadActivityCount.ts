import { useEffect, useState } from 'react'
import { useToastStore } from '../stores/toastStore'
import { safeStorage } from '../lib/safeStorage'

const SEEN_KEY = 'activity_last_seen_at'

/**
 * Compte les activités publiques (toasts du toastStore) plus récentes que
 * la dernière visite de la page /activite. Stocké en localStorage.
 *
 * Distinct de useNotificationStore.unreadCount() qui concerne les notifs
 * personnelles (mécène, milestones, expedition_message, etc.).
 */
export function useUnreadActivityCount(): number {
  const toasts = useToastStore((s) => s.toasts)
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

  return toasts.filter((t) => t.timestamp > seenAt).length
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
