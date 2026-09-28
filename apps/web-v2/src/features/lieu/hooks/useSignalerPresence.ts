/**
 * QUOI     — tant que l'app est ouverte et la position autorisée, signaler sa présence au serveur
 *            au plus une fois par minute ; dès qu'on l'autorise en cours de route, aussi.
 * POURQUOI — c'est ce qui permet d'être proposé comme compagnon à qui revendique un lieu à côté
 *            (spec fiche §6). Jamais de demande de permission ici : sans autorisation, rien.
 */
import { useEffect } from 'react'
import { signalerPresence } from '../api/lieu'

const UNE_MINUTE = 60_000

export function useSignalerPresence() {
  useEffect(() => {
    if (!('geolocation' in navigator) || !('permissions' in navigator)) return
    let annule = false
    let minuteur: ReturnType<typeof setInterval> | undefined
    const signaler = () => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          // Un signal perdu ne dérange personne : le suivant partira dans une minute.
          void signalerPresence(coords.latitude, coords.longitude).catch(() => undefined)
        },
        () => undefined,
        { maximumAge: UNE_MINUTE, timeout: 15_000 },
      )
    }
    const suivre = (statut: PermissionStatus) => {
      clearInterval(minuteur)
      if (annule || statut.state !== 'granted') return
      signaler()
      minuteur = setInterval(signaler, UNE_MINUTE)
    }
    navigator.permissions.query({ name: 'geolocation' }).then(
      (statut) => {
        statut.onchange = () => {
          suivre(statut)
        }
        suivre(statut)
      },
      () => undefined,
    )
    return () => {
      annule = true
      clearInterval(minuteur)
    }
  }, [])
}
