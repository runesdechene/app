import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import { useFactionHallStore } from '../stores/factionHallStore'

const KEY = 'pendingCompanyInvite'

/**
 * Lien d'invitation Compagnie : `?company=<clé>` où la clé est le public_slug aléatoire
 * (ou, rétro-compat, l'ancien id). On résout la clé → id réel avant d'ouvrir le Hall.
 * - Capture le param à l'arrivée (avant auth) et le stocke (survit au flux login).
 * - Une fois connecté, résout puis ouvre le Hall de la Compagnie (il y postule).
 * Appelé dans MapPage + MobileLayout (l'un ou l'autre est monté après auth).
 */
export function useCompanyInvite() {
  const userId = usePlayerStore(s => s.userId)
  const openHall = useFactionHallStore(s => s.open)

  // 1. Capture (une fois) — nettoie l'URL pour ne pas re-déclencher.
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get('company')
    if (key) {
      sessionStorage.setItem(KEY, key)
      const url = window.location.pathname + window.location.hash
      window.history.replaceState({}, '', url)
    }
  }, [])

  // 2. Consomme dès qu'on a un utilisateur connecté : résout la clé → id, ouvre le Hall.
  useEffect(() => {
    if (!userId) return
    const key = sessionStorage.getItem(KEY)
    if (!key) return
    sessionStorage.removeItem(KEY)

    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('factions')
        .select('id')
        .or(`public_slug.eq.${key},id.eq.${key}`)
        .maybeSingle()
      if (cancelled) return
      const id = (data as { id: string } | null)?.id ?? key // fallback : la clé est peut-être déjà un id
      openHall(id)
    })()
    return () => { cancelled = true }
  }, [userId, openHall])
}
