import { useEffect } from 'react'
import { usePlayerStore } from '../stores/playerStore'
import { useFactionHallStore } from '../stores/factionHallStore'

const KEY = 'pendingCompanyInvite'

/**
 * Lien d'invitation Compagnie : `?company=<factionId>`.
 * - Capture le param à l'arrivée (avant auth) et le stocke (survit au flux login).
 * - Une fois l'utilisateur connecté, ouvre le Hall de la Compagnie (il y postule).
 * Appelé dans MapPage + MobileLayout (l'un ou l'autre est monté après auth).
 */
export function useCompanyInvite() {
  const userId = usePlayerStore(s => s.userId)
  const openHall = useFactionHallStore(s => s.open)

  // 1. Capture (une fois) — nettoie l'URL pour ne pas re-déclencher.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('company')
    if (id) {
      sessionStorage.setItem(KEY, id)
      const url = window.location.pathname + window.location.hash
      window.history.replaceState({}, '', url)
    }
  }, [])

  // 2. Consomme dès qu'on a un utilisateur connecté.
  useEffect(() => {
    if (!userId) return
    const id = sessionStorage.getItem(KEY)
    if (id) {
      sessionStorage.removeItem(KEY)
      openHall(id)
    }
  }, [userId, openHall])
}
