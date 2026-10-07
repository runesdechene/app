/**
 * QUOI     — mes énigmes résolues (toutes les cultures), et une culture en détail.
 * POURQUOI — la page « Les énigmes » et le menu du profil (« 137 résolues ») lisent la même clé :
 *            une bonne réponse sur la carte l'invalide (`features/carte/hooks/useEnigme.ts`).
 */
import { useQuery } from '@tanstack/react-query'
import { fetchMaCulture, fetchMesEnigmes } from '../api/mesEnigmes'

export function useMesEnigmes() {
  const query = useQuery({ queryKey: ['mes-enigmes'], queryFn: fetchMesEnigmes })
  return { mesEnigmes: query.data, erreur: query.isError, reessayer: query.refetch }
}

export function useMaCulture(id: string) {
  const query = useQuery({ queryKey: ['mes-enigmes', id], queryFn: () => fetchMaCulture(id) })
  return { maCulture: query.data, erreur: query.isError, reessayer: query.refetch }
}
