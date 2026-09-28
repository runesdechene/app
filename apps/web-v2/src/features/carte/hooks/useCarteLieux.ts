/**
 * QUOI     — tous les lieux de la carte, depuis le cache ou la base.
 * POURQUOI — `lieux` vaut `undefined` pendant le chargement ; l'écran propose de réessayer
 *            en cas d'erreur.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchCarteLieux } from '../api/carte'
import type { LieuCarte } from '../api/lireCarte'

export function useCarteLieux(): {
  lieux: LieuCarte[] | undefined
  erreur: boolean
  reessayer: () => void
} {
  const query = useQuery({ queryKey: ['carte', 'lieux'], queryFn: fetchCarteLieux })
  return {
    lieux: query.data,
    erreur: query.isError,
    reessayer: () => {
      void query.refetch()
    },
  }
}
