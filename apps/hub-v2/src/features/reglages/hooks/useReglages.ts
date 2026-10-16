/**
 * QUOI     — les réglages (lecture) et leurs deux écritures, qui relisent la table même si le retrait de l'ancienne image a échoué.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enregistrerPartage, lireReglages, remplacerImageSeo } from '../api/reglages'

const CLE = ['hub-reglages']

export function useReglages() {
  return useQuery({ queryKey: CLE, queryFn: lireReglages })
}

export function useEnregistrerPartage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: enregistrerPartage,
    onSettled: () => client.invalidateQueries({ queryKey: CLE }),
  })
}

export function useRemplacerImageSeo() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ fichier, ancienne }: { fichier: File; ancienne: string }) => remplacerImageSeo(fichier, ancienne),
    onSettled: () => client.invalidateQueries({ queryKey: CLE }),
  })
}
