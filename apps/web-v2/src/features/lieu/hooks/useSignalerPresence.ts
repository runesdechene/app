/**
 * QUOI     — tant que l'app est ouverte et la position autorisée, signaler sa présence au serveur
 *            au plus une fois par minute ; dès qu'on l'autorise en cours de route, aussi.
 * POURQUOI — c'est ce qui fait apparaître l'Explorateur sur la carte (Actifs) et le propose comme
 *            compagnon à qui revendique un lieu à côté (spec fiche §6). Jamais de demande de
 *            permission ici : c'est l'invitation « Apparaître sur la carte » qui la fait.
 */
import { useEffect } from 'react'
import { useAutorisationPosition } from '@/shared/hooks/useAutorisationPosition'
import { signalerPresence } from '../api/lieu'

const UNE_MINUTE = 60_000

export function useSignalerPresence() {
  const { autorisation } = useAutorisationPosition()

  useEffect(() => {
    if (autorisation !== 'accordee') return
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
    signaler()
    const minuteur = setInterval(signaler, UNE_MINUTE)
    return () => {
      clearInterval(minuteur)
    }
  }, [autorisation])
}
