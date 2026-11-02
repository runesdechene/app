/**
 * QUOI     — l'anecdote qu'un visiteur sans compte lit sur la fiche d'un motif scanné.
 * POURQUOI — spec du Codex : sans compte, le scan montre aussi une anecdote, mais rien n'est gardé.
 *            Une par visite de la fiche ; recharger en tire une autre (Uriel, 02/11 : c'est voulu).
 */
import { useQuery } from '@tanstack/react-query'
import { anecdoteAuHasard } from '../api/anecdote'

export function useAnecdoteDuVisiteur(id: number, visiteur: boolean) {
  const query = useQuery({
    queryKey: ['anecdote-du-visiteur', id],
    queryFn: () => anecdoteAuHasard(id),
    enabled: visiteur,
    staleTime: Infinity,
  })
  return query.data ?? null
}
