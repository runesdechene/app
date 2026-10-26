/**
 * QUOI     — suivre la position dès l'ouverture de l'app, tant qu'elle est ouverte.
 * POURQUOI — comme la V1 : `watchPosition` tout de suite, le navigateur pose sa question lui-même,
 *            et chaque relevé déplace l'Explorateur sur la carte (Uriel, 26/10). On ne demande pas
 *            d'abord l'autorisation : Safari sur iPhone répond « à demander » à chaque ouverture,
 *            même accordée, et rien ne démarrait.
 * ATTENTION — un refus arrête le suivi ; il repart quand l'autorisation revient (Préférences).
 */
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { Autorisation } from '../lib/position'
import { AUTORISATION, useAutorisationPosition } from './useAutorisationPosition'
import { MA_POSITION, useMaPosition } from './useMaPosition'

export function useSuivrePosition() {
  const queryClient = useQueryClient()
  const refusee = useAutorisationPosition().autorisation === 'refusee'
  useMaPosition() // garde le point en cache, même quand aucun écran ne le lit

  useEffect(() => {
    if (refusee || !('geolocation' in navigator)) return
    // Ce que dit le GPS fait foi : la lecture de l'autorisation encore en cours ne l'écrase pas.
    const autorisation = (valeur: Autorisation) => {
      void queryClient.cancelQueries({ queryKey: AUTORISATION })
      queryClient.setQueryData(AUTORISATION, valeur)
    }
    const geo = navigator.geolocation
    const id = geo.watchPosition(
      ({ coords }) => {
        queryClient.setQueryData(MA_POSITION, {
          latitude: coords.latitude,
          longitude: coords.longitude,
        })
        // Une position reçue vaut autorisation, quoi qu'en dise Safari.
        autorisation('accordee')
      },
      (erreur) => {
        // Seul un refus est un refus : un GPS lent ou introuvable réessaie de lui-même.
        if (erreur.code === 1) autorisation('refusee')
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    )
    return () => {
      geo.clearWatch(id)
    }
  }, [refusee, queryClient])
}
