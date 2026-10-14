/**
 * QUOI     — les cultures du Hub (liste et fiches viennent de la même lecture) et leur écriture, qui
 *            rafraîchit la liste, et la liste simple des cultures utilisée par les filtres d'énigmes.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enregistrerCulture, lireCulturesDuHub, type CultureAEnregistrer } from '../api/cultures'

export function useCulturesDuHub() {
  return useQuery({ queryKey: ['hub-cultures-du-hub'], queryFn: lireCulturesDuHub })
}

export function useEcritureCulture() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (culture: CultureAEnregistrer) => enregistrerCulture(culture),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['hub-cultures-du-hub'] })
      void client.invalidateQueries({ queryKey: ['hub-cultures'] })
    },
  })
}
