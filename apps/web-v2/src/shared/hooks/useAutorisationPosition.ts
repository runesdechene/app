/**
 * QUOI     — où en est l'autorisation de position, suivie en direct, et le geste qui la demande.
 * POURQUOI — l'invitation « Apparaître sur la carte », sa ligne des Préférences, et le suivi de
 *            position (qui s'arrête sur un refus et repart quand on autorise). Un seul état pour
 *            tous, gardé par TanStack Query ; le suivi le corrige à chaque position reçue.
 * ATTENTION — null tant que le navigateur n'a pas répondu : rien ne s'affiche à tort.
 *            Safari ne prévient pas toujours d'un changement, et répond « à demander » même
 *            accordée : c'est la position reçue qui fait foi.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { demanderPosition, lireAutorisation, statutDeLaPosition } from '../lib/position'
import { MA_POSITION } from './useMaPosition'

export const AUTORISATION = ['autorisation-position'] as const

export function useAutorisationPosition() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: AUTORISATION,
    queryFn: lireAutorisation,
    staleTime: Infinity,
  })

  // Accordée ou retirée depuis les réglages du navigateur, l'appli ouverte.
  useEffect(() => {
    let annule = false
    let statut: PermissionStatus | null = null
    const relire = () => {
      void queryClient.invalidateQueries({ queryKey: AUTORISATION })
    }
    void statutDeLaPosition().then((s) => {
      if (annule || !s) return
      statut = s
      s.addEventListener('change', relire)
    })
    return () => {
      annule = true
      statut?.removeEventListener('change', relire)
    }
  }, [queryClient])

  async function autoriser() {
    const point = await demanderPosition()
    if (!point) {
      await queryClient.invalidateQueries({ queryKey: AUTORISATION })
      return
    }
    // Accordée : le suivi (arrêté s'il y avait eu refus) repart de lui-même.
    queryClient.setQueryData(MA_POSITION, point)
    queryClient.setQueryData(AUTORISATION, 'accordee')
  }

  return { autorisation: data ?? null, autoriser }
}
