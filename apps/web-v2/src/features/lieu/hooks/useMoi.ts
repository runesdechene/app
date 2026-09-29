/**
 * QUOI     — qui regarde la fiche : son identifiant, et s'il est admin.
 * POURQUOI — la fiche change selon qui la lit : on ne s'envoie pas de cœurs sur son propre lieu,
 *            seuls l'auteur et les admins peuvent le supprimer. La base revérifie toujours.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchMoi } from '../api/lieu'

export function useMoi() {
  return useQuery({ queryKey: ['moi', 'droits'], queryFn: fetchMoi, staleTime: Infinity }).data
}
