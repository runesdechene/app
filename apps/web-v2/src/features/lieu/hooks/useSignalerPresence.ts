/**
 * QUOI     — tant que l'app est ouverte et la position déjà autorisée, signaler sa présence au
 *            serveur au plus une fois par minute.
 * POURQUOI — c'est ce qui permet d'être proposé comme compagnon à qui revendique un lieu à côté
 *            (spec fiche §6). Jamais de demande de permission ici : sans autorisation, rien.
 */
import { useEffect } from 'react'
import { signalerPresence } from '../api/lieu'

const UNE_MINUTE = 60_000

export function useSignalerPresence() {
  useEffect(() => {
    if (!('geolocation' in navigator) || !('permissions' in navigator)) return
    let minuteur: ReturnType<typeof setInterval> | undefined
    const signaler = () => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          void signalerPresence(coords.latitude, coords.longitude).catch(() => undefined)
        },
        () => undefined,
        { maximumAge: UNE_MINUTE, timeout: 15_000 },
      )
    }
    void navigator.permissions.query({ name: 'geolocation' }).then((statut) => {
      if (statut.state !== 'granted') return
      signaler()
      minuteur = setInterval(signaler, UNE_MINUTE)
    })
    return () => {
      clearInterval(minuteur)
    }
  }, [])
}
