/**
 * QUOI     — les cœurs en vol d'un bouton : `lancer` en ajoute un à chaque toucher, `finir` le
 *            retire quand son envol est fini. `Envols` (shared/ui) les dessine.
 */
import { useRef, useState } from 'react'

export function useEnvols() {
  const [envols, setEnvols] = useState<number[]>([])
  const prochain = useRef(0)
  return {
    envols,
    lancer: () => {
      const n = prochain.current++
      setEnvols((avant) => [...avant, n])
    },
    finir: (n: number) => {
      setEnvols((avant) => avant.filter((e) => e !== n))
    },
  }
}
