/**
 * QUOI     — tous les lieux de la carte, depuis le cache ou la base : ceux de l'Explorateur
 *            connecté, ou ceux d'un visiteur (positions floutées).
 * POURQUOI — `lieux` vaut `undefined` pendant le chargement ; l'écran propose de réessayer
 *            en cas d'erreur.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchCarteLieux, fetchCartePublique } from '../api/carte'
import type { LieuCarte } from '../api/lireCarte'

// Les lieux de l'Explorateur connecté : la même clé pour la carte et pour sa préparation
// (usePreparerLaCarte).
export const carteLieuxKey = ['carte', 'lieux'] as const

export function useCarteLieux(visiteur: boolean): {
  lieux: LieuCarte[] | undefined
  erreur: boolean
  reessayer: () => void
} {
  const query = useQuery({
    queryKey: visiteur ? ['carte', 'publique'] : carteLieuxKey,
    queryFn: visiteur ? fetchCartePublique : fetchCarteLieux,
  })
  return {
    lieux: query.data,
    erreur: query.isError,
    reessayer: () => {
      void query.refetch()
    },
  }
}
