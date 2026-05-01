import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '../stores/playerStore'

interface LevelUpEvent {
  levelBefore: number
  levelAfter: number
}

const STORAGE_PREFIX = 'lastAckedLevel_'

/**
 * Surveille les changements de level dans playerStore.
 * Déclenche la modale de level up uniquement quand le niveau dépasse
 * le dernier niveau acquitté (persisté en localStorage par user).
 *
 * - Au premier chargement (jamais acquitté) : on initialise localStorage au
 *   niveau actuel sans déclencher de modale.
 * - Si reload avec un niveau supérieur au dernier acquitté (level up offline) :
 *   modale s'affiche.
 * - Si action live fait monter le niveau : modale s'affiche.
 * - Au dismiss : localStorage est mis à jour avec le niveau actuel.
 *
 * Le flag `levelInitialized` du store évite les faux positifs entre les
 * valeurs par défaut (level=1) et la première vraie valeur reçue de la RPC.
 *
 * Usage :
 *   const { pendingLevelUp, dismiss } = useLevelUp()
 *   {pendingLevelUp && <LevelUpModal {...pendingLevelUp} onClose={dismiss} />}
 */
export function useLevelUp() {
  const level = usePlayerStore(s => s.level)
  const userId = usePlayerStore(s => s.userId)
  const levelInitialized = usePlayerStore(s => s.levelInitialized)
  const previousLevelRef = useRef<number | null>(null)
  const [pendingLevelUp, setPendingLevelUp] = useState<LevelUpEvent | null>(null)

  useEffect(() => {
    if (!userId) {
      previousLevelRef.current = null
      return
    }
    if (!levelInitialized) return

    const storageKey = `${STORAGE_PREFIX}${userId}`

    if (previousLevelRef.current === null) {
      // Premier render initialisé pour ce userId : init baseline
      const stored = localStorage.getItem(storageKey)
      if (stored === null) {
        // Jamais acquitté → on grave le niveau actuel sans déclencher
        localStorage.setItem(storageKey, String(level))
        previousLevelRef.current = level
        return
      }
      const baseline = Number(stored)
      previousLevelRef.current = baseline
      if (level > baseline) {
        setPendingLevelUp({ levelBefore: baseline, levelAfter: level })
      }
      return
    }

    // Renders suivants : détection live d'un passage de niveau
    if (level > previousLevelRef.current) {
      setPendingLevelUp({ levelBefore: previousLevelRef.current, levelAfter: level })
    }
    previousLevelRef.current = level
  }, [level, userId, levelInitialized])

  const dismiss = () => {
    if (userId) {
      localStorage.setItem(`${STORAGE_PREFIX}${userId}`, String(level))
    }
    previousLevelRef.current = level
    setPendingLevelUp(null)
  }

  return { pendingLevelUp, dismiss }
}
