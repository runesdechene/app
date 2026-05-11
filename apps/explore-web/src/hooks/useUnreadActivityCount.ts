import { useSyncExternalStore } from 'react'
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
 *
 * V0.8.9 (11/05) — Refacto useState+localStorage+StorageEvent → module-level
 * state + useSyncExternalStore. L'ancien `dispatchEvent(new StorageEvent)` ne
 * fire PAS sur les listeners "storage" de la même tab dans Safari (et parfois
 * Chrome) — l'event natif est cross-tab uniquement. Conséquence : depuis
 * /accueil ou /chat (où BottomTabbar reste monté via MobileLayout), la
 * pastille rouge ne se réinitialisait pas en visitant /activite. Depuis /carte
 * ça marchait par accident (BottomTabbar démontée puis remontée → useState
 * initial relisait le localStorage frais).
 */

// Module-level state partagé entre toutes les instances du hook.
let _seenAt: number = (() => {
  const raw = safeStorage.get(SEEN_KEY)
  const parsed = raw ? Number(raw) : 0
  return Number.isFinite(parsed) ? parsed : 0
})()
const _listeners = new Set<() => void>()

function _subscribe(cb: () => void): () => void {
  _listeners.add(cb)
  return () => { _listeners.delete(cb) }
}

function _getSeenAt(): number {
  return _seenAt
}

export function useUnreadActivityCount(): number {
  const toasts = useToastStore((s) => s.toasts)
  const currentUserId = usePlayerStore((s) => s.userId)
  const seenAt = useSyncExternalStore(_subscribe, _getSeenAt, _getSeenAt)
  // Convention : les toasts auto-générés par l'utilisateur lui-même
  // (discover, explore, plant_flag, etc.) n'ont PAS d'actorId. Les toasts
  // venant des AUTRES users via Realtime (loadRecentActivityToasts,
  // usePlayer, useCourtNotifications…) ont toujours actorId set.
  // Donc : pas d'actorId = mes propres actions = ignorer pour la pastille.
  return toasts.filter((t) => t.timestamp > seenAt && !!t.actorId && t.actorId !== currentUserId).length
}

/** Marquer toute l'activité comme lue (à appeler en entrant sur /activite). */
export function markActivitySeen(): void {
  const now = Date.now()
  _seenAt = now
  safeStorage.set(SEEN_KEY, String(now))
  _listeners.forEach((cb) => cb())
}
