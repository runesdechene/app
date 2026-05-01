import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '../stores/playerStore'

interface LevelUpEvent {
  levelBefore: number
  levelAfter: number
}

/**
 * Surveille les changements de level dans playerStore.
 * Quand level augmente (suite à un refresh post-action), expose un event
 * pour que App.tsx affiche la LevelUpModal.
 *
 * Usage :
 *   const { pendingLevelUp, dismiss } = useLevelUp()
 *   {pendingLevelUp && <LevelUpModal {...pendingLevelUp} onClose={dismiss} />}
 */
export function useLevelUp() {
  const level = usePlayerStore(s => s.level)
  const previousLevelRef = useRef<number>(level)
  const [pendingLevelUp, setPendingLevelUp] = useState<LevelUpEvent | null>(null)

  useEffect(() => {
    const previous = previousLevelRef.current
    if (level > previous) {
      setPendingLevelUp({ levelBefore: previous, levelAfter: level })
    }
    previousLevelRef.current = level
  }, [level])

  const dismiss = () => setPendingLevelUp(null)

  return { pendingLevelUp, dismiss }
}
