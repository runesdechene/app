/**
 * Passerelle V1 → V2 côté React.
 * - useV2QueryRedirect : ?v=2 dans l'URL d'arrivée → /v2/ si le compte y a accès.
 *   Le paramètre est lu au PREMIER rendu : la landing peut rediriger avant qu'un effet
 *   ne voie l'URL d'origine.
 * - useCanTryV2 : affiche « Essayer la V2 » dans les menus (ProfileMenu + MobileHeader).
 */
import { useEffect, useState } from 'react'
import { usePlayerStore } from '../stores/playerStore'
import { goToV2, hasV2Access, wantsV2 } from '../lib/v2Access'

export function useV2QueryRedirect(): void {
  const [wanted] = useState(() => wantsV2(window.location.search))
  const userId = usePlayerStore(s => s.userId)

  useEffect(() => {
    if (!wanted || !userId) return
    void hasV2Access().then(ok => {
      if (ok) goToV2()
    })
  }, [wanted, userId])
}

export function useCanTryV2(): boolean {
  const userId = usePlayerStore(s => s.userId)
  const [can, setCan] = useState(false)

  useEffect(() => {
    if (!userId) return
    let active = true
    void hasV2Access().then(ok => {
      if (active) setCan(ok)
    })
    return () => {
      active = false
    }
  }, [userId])

  return can
}
