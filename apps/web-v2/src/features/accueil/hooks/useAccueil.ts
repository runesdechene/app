/**
 * QUOI     — les lectures de l'Accueil : la bannière de la boutique, les lieux ajoutés, le fil.
 * POURQUOI — chacune a sa clé, sous ['accueil'] : un bloc qui échoue n'emporte pas les autres,
 *            et une visite ou un ajout relit tout l'Accueil d'une seule invalidation.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchAjoutes, fetchBanniere, fetchChemins } from '../api/accueil'

export const cheminsKey = ['accueil', 'chemins'] as const

// Tirée au hasard une fois par ouverture : elle ne change pas pendant qu'on la regarde.
export function useBanniere() {
  const query = useQuery({
    queryKey: ['accueil', 'banniere'],
    queryFn: fetchBanniere,
    staleTime: Infinity,
  })
  return query.data ?? null
}

export function useAjoutes() {
  return useQuery({ queryKey: ['accueil', 'ajoutes'], queryFn: fetchAjoutes }).data ?? []
}

export function useChemins() {
  const query = useQuery({ queryKey: cheminsKey, queryFn: fetchChemins })
  return { chemins: query.data, erreur: query.isError }
}
