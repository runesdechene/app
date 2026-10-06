/**
 * QUOI     — ma position suivie en direct, avec sa précision en mètres.
 * POURQUOI — le pin GPS (Uriel, 06/10) : au-delà de ± 200 m on ne pose pas. La précision
 *            s'affine en quelques secondes : on la suit (watchPosition), haute précision, sans
 *            vieille position en cache. Le GPS marche sans réseau.
 * ATTENTION — « indisponible » : le téléphone ne trouve pas sa position (localisation coupée dans
 *            ses réglages, code 2) ou n'en a trouvé aucune avant le délai (code 3). Un délai
 *            dépassé après une position garde la dernière : le suivi continue.
 */
import { useEffect, useState } from 'react'
import type { Point } from '@/shared/lib/distance'

export const PRECISION_MAX_M = 200

export type PositionPrecise =
  | { etat: 'attente' }
  | { etat: 'refusee' }
  | { etat: 'indisponible' }
  | { etat: 'trouvee'; point: Point; precision: number }

export function usePositionPrecise(): PositionPrecise {
  // Pas de GPS dans l'appareil : refusée d'emblée (état de départ, pas un setState dans l'effet).
  const [position, setPosition] = useState<PositionPrecise>(() =>
    'geolocation' in navigator ? { etat: 'attente' } : { etat: 'refusee' },
  )
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    const suivi = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setPosition({
          etat: 'trouvee',
          point: { latitude: coords.latitude, longitude: coords.longitude },
          precision: coords.accuracy,
        })
      },
      (erreur) => {
        if (erreur.code === 1) setPosition({ etat: 'refusee' })
        else if (erreur.code === 2) setPosition({ etat: 'indisponible' })
        else setPosition((p) => (p.etat === 'trouvee' ? p : { etat: 'indisponible' }))
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    )
    return () => {
      navigator.geolocation.clearWatch(suivi)
    }
  }, [])
  return position
}
