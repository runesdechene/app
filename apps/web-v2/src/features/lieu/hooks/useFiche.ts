/**
 * QUOI     — la fiche d'un lieu, depuis le cache ou la base.
 * POURQUOI — `fiche` vaut `undefined` pendant le chargement, `null` si le lieu est introuvable ou
 *            invisible : l'écran distingue les deux.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchFiche } from '../api/lieu'
import type { FicheLieu } from '../api/lireLieu'

export const ficheKey = (id: string) => ['lieu', id] as const

export function useFiche(id: string): {
  fiche: FicheLieu | null | undefined
  erreur: boolean
  reessayer: () => void
} {
  const query = useQuery({ queryKey: ficheKey(id), queryFn: () => fetchFiche(id) })
  return {
    fiche: query.data,
    erreur: query.isError,
    reessayer: () => {
      void query.refetch()
    },
  }
}
