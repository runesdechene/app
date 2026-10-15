/**
 * QUOI     — l'écriture d'une culture, qui rafraîchit la liste (lue par shared/cultures) et celle des filtres d'énigmes.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { enregistrerCulture, type CultureAEnregistrer } from '../api/cultures'

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
