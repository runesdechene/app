/**
 * QUOI     — les mises à jour publiées, pour la page « Nouveautés ».
 * POURQUOI — les lire ne marque rien : c'est l'ouverture de la cloche qui les rend lues.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchMisesAJour } from '../api/nouveautes'

export function useNouveautes() {
  const query = useQuery({ queryKey: ['nouveautes'], queryFn: fetchMisesAJour })
  return { misesAJour: query.data, erreur: query.isError, reessayer: query.refetch }
}
