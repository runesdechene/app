/**
 * QUOI     — les anecdotes d'un motif sur sa fiche : le tirage gratuit d'un scan (une fois par scan :
 *            sa clé porte l'heure du scan, il ne se rejoue pas) et « Creuser encore ».
 * POURQUOI — après un tirage, l'énergie, le Codex et la fiche se relisent.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PasAssezDEnergie, tirerAnecdote } from '../api/anecdote'
import { cleMonFragment } from './useMonFragment'

export function useAnecdotes(id: number, scan: number | null) {
  const client = useQueryClient()
  const relire = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['energie'] }),
      client.invalidateQueries({ queryKey: ['codex'] }),
      client.invalidateQueries({ queryKey: cleMonFragment(id) }),
    ])

  const tirage = useQuery({
    queryKey: ['tirage', id, scan],
    queryFn: async () => {
      const t = await tirerAnecdote(id, false)
      await relire()
      return t
    },
    enabled: scan !== null,
    staleTime: Infinity,
    retry: false,
  })

  const creusage = useMutation({
    mutationFn: () => tirerAnecdote(id, true),
    onSuccess: async (t) => {
      client.setQueryData(['tirage', id, scan], t)
      await relire()
    },
  })

  return {
    tirage: tirage.data ?? null,
    creuser: () => {
      creusage.mutate()
    },
    enCours: creusage.isPending,
    plusDEnergie: creusage.error instanceof PasAssezDEnergie,
  }
}
