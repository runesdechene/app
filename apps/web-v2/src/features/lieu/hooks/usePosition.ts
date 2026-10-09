/**
 * QUOI     — ma position, suivie tant que la fiche est ouverte ; ou pourquoi on ne l'a pas.
 * POURQUOI — le bouton de visite change d'état quand on s'approche, sans recharger. On ne
 *            demande la position que sur un geste (« Me localiser pour visiter ») ; déjà
 *            autorisée, on la suit tout de suite.
 */
import { useCallback, useEffect, useState } from 'react'
import type { Position } from '../lib/etatVisite'

export function usePosition(): { position: Position; demander: () => void } {
  // Sans géolocalisation du tout, on le sait dès le départ.
  const [position, setPosition] = useState<Position>(() =>
    'geolocation' in navigator ? 'inconnue' : 'refusee',
  )
  const [suivre, setSuivre] = useState(false)

  useEffect(() => {
    if (!('geolocation' in navigator) || !('permissions' in navigator)) return
    void navigator.permissions.query({ name: 'geolocation' }).then((statut) => {
      if (statut.state === 'granted') setSuivre(true)
      if (statut.state === 'denied') setPosition('refusee')
    })
  }, [])

  useEffect(() => {
    if (!suivre || !('geolocation' in navigator)) return
    const geo = navigator.geolocation
    const id = geo.watchPosition(
      ({ coords }) => {
        setPosition({ lat: coords.latitude, lng: coords.longitude })
      },
      (erreur) => {
        // Seul un refus est un refus : une position lente ou introuvable reste « à localiser ».
        if (erreur.code === 1) setPosition('refusee')
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    )
    return () => {
      geo.clearWatch(id)
    }
  }, [suivre])

  const demander = useCallback(() => {
    setSuivre(true)
  }, [])

  return { position, demander }
}
