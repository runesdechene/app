/**
 * QUOI     — une valeur qui ne change qu'une fois la frappe posée (après `delai` ms sans bouger).
 * POURQUOI — une recherche qui interroge la base attend qu'on ait fini de taper : « dolmen » ne
 *            lance pas six requêtes. La vitrine et la carte s'en servent.
 */
import { useEffect, useState } from 'react'

export function usePose<T>(valeur: T, delai: number) {
  const [posee, setPosee] = useState(valeur)
  useEffect(() => {
    const minuteur = setTimeout(() => {
      setPosee(valeur)
    }, delai)
    return () => {
      clearTimeout(minuteur)
    }
  }, [valeur, delai])
  return posee
}
