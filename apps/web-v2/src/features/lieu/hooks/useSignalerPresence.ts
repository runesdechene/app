/**
 * QUOI     — tant que l'app est ouverte et la position connue, signaler sa présence au serveur :
 *            dès la première position, puis une fois par minute avec la dernière.
 * POURQUOI — c'est ce qui fait apparaître l'Explorateur sur la carte des autres (Actifs) et le
 *            propose comme compagnon à qui revendique un lieu à côté (spec fiche §6). La position
 *            vient du suivi de l'app (`useSuivrePosition`) : pas de seconde lecture du GPS ici.
 */
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { MA_POSITION, useMaPosition } from '@/shared/hooks/useMaPosition'
import type { Point } from '@/shared/lib/distance'
import { signalerPresence } from '../api/lieu'

const UNE_MINUTE = 60_000

export function useSignalerPresence() {
  const queryClient = useQueryClient()
  const connue = useMaPosition() !== null

  useEffect(() => {
    if (!connue) return
    const signaler = () => {
      // La dernière position, prise dans le cache : un pas ne relance pas le minuteur.
      const p = queryClient.getQueryData<Point>(MA_POSITION)
      // Un signal perdu ne dérange personne : le suivant partira dans une minute.
      if (p) void signalerPresence(p.latitude, p.longitude).catch(() => undefined)
    }
    signaler()
    const minuteur = setInterval(signaler, UNE_MINUTE)
    return () => {
      clearInterval(minuteur)
    }
  }, [connue, queryClient])
}
