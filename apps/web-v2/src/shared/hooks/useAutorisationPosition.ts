/**
 * QUOI     — où en est l'autorisation de position, suivie en direct, et le geste qui la demande.
 * POURQUOI — l'invitation « Apparaître sur la carte », sa ligne des Préférences et l'envoi de la
 *            présence (Uriel, 07/10 : la V1 invitait, la V2 attendait en silence et personne
 *            n'apparaissait sur la carte). Un seul état pour tous, gardé par TanStack Query :
 *            autorisée depuis l'invitation, la présence part aussitôt.
 * ATTENTION — null tant que le navigateur n'a pas répondu : rien ne s'affiche à tort.
 *            Après « Autoriser », l'état est relu : Safari ne prévient pas toujours du changement.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { demanderPosition, lireAutorisation, statutDeLaPosition } from '../lib/position'

const CLE = ['autorisation-position'] as const

export function useAutorisationPosition() {
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: CLE, queryFn: lireAutorisation, staleTime: Infinity })

  // Accordée ou retirée depuis les réglages du navigateur, l'appli ouverte.
  useEffect(() => {
    let annule = false
    let statut: PermissionStatus | null = null
    const relire = () => {
      void queryClient.invalidateQueries({ queryKey: CLE })
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
    await demanderPosition()
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: CLE }),
      // Les distances des lieux (Accueil, profil) attendaient cette position.
      queryClient.invalidateQueries({ queryKey: ['ma-position'] }),
    ])
  }

  return { autorisation: data ?? null, autoriser }
}
