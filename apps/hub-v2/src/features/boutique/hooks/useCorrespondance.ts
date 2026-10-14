/**
 * QUOI     — la lecture des correspondances Shopify, l'ajout et le retrait d'une correspondance.
 * POURQUOI — un enregistrement réussi rafraîchit la liste.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ajouterCorrespondance, lireCorrespondances, retirerCorrespondance } from '../api/correspondance'

export function useCorrespondances() {
  return useQuery({ queryKey: ['hub-correspondances'], queryFn: lireCorrespondances })
}

export function useAjouterCorrespondance() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ tag, fragmentId }: { tag: string; fragmentId: number }) => ajouterCorrespondance(tag, fragmentId),
    onSuccess: () => client.invalidateQueries({ queryKey: ['hub-correspondances'] }),
  })
}

export function useRetirerCorrespondance() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => retirerCorrespondance(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['hub-correspondances'] }),
  })
}
