/**
 * QUOI     — les mises à jour publiées, pour la page « Nouveautés ».
 * POURQUOI — les lire ne marque rien : c'est l'ouverture de la cloche qui les rend lues.
 * ATTENTION — la clé `nouveautesKey` est aussi le préfixe du carnet et des cœurs de chaque note.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchMisesAJour } from '../api/nouveautes'

export const nouveautesKey = ['nouveautes'] as const

export function useNouveautes() {
  const query = useQuery({ queryKey: nouveautesKey, queryFn: fetchMisesAJour })
  return { misesAJour: query.data, erreur: query.isError, reessayer: query.refetch }
}
