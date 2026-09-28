/**
 * QUOI     — les trois lectures de l'Accueil : la nouveauté, les lieux ajoutés, le fil.
 * POURQUOI — chacune a sa clé, sous ['accueil'] : un bloc qui échoue n'emporte pas les autres,
 *            et une visite ou un ajout relit tout l'Accueil d'une seule invalidation.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchAjoutes, fetchChemins, fetchNouveaute } from '../api/accueil'

export const cheminsKey = ['accueil', 'chemins'] as const

export function useNouveaute() {
  return useQuery({ queryKey: ['accueil', 'nouveaute'], queryFn: fetchNouveaute }).data ?? null
}

export function useAjoutes() {
  return useQuery({ queryKey: ['accueil', 'ajoutes'], queryFn: fetchAjoutes }).data ?? []
}

export function useChemins() {
  const query = useQuery({ queryKey: cheminsKey, queryFn: fetchChemins })
  return { chemins: query.data, erreur: query.isError }
}
