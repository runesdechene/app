/**
 * QUOI     — déclarer « J'y suis allé » (mig 531) : le mois du souvenir, puis, s'il y en a un, le
 *            mot (et sa photo) au Carnet de passage.
 * POURQUOI — le souvenir compte d'abord : si le mot ne part pas, le souvenir reste noté et on le
 *            dit (`motPerdu`), au lieu de tout refuser. Une réussite relit la fiche (et son
 *            carnet), la carte, les profils (le passeport) et « Sur les chemins ».
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { PhotoAEnvoyer } from '@/shared/lib/photo'
import { cheminsKey } from '@/shared/lib/cles'
import { declarerSouvenir, ecrireAuCarnet } from '../api/lieu'
import { ficheKey } from './useFiche'

export type Souvenir = { annee: number; mois: number; mot: string; photo: PhotoAEnvoyer | null }

function messageDeRefus(erreur: unknown): string {
  const indice =
    typeof erreur === 'object' && erreur !== null && 'hint' in erreur ? erreur.hint : null
  if (indice === 'deja') return 'Ce lieu est déjà dans ton passeport.'
  if (indice === 'futur') return 'Ce mois n’est pas encore passé.'
  if (indice === 'decouvrir') return 'Découvre ce lieu sur la carte d’abord.'
  return 'Ton souvenir n’a pas pu être noté. Réessaie dans un instant.'
}

export function useSouvenir(id: string) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async ({ annee, mois, mot, photo }: Souvenir) => {
      await declarerSouvenir(id, annee, mois)
      if (mot === '') return { motPerdu: false }
      try {
        await ecrireAuCarnet(id, mot, photo ? [photo] : [], null)
        return { motPerdu: false }
      } catch {
        return { motPerdu: true }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ficheKey(id) })
      void queryClient.invalidateQueries({ queryKey: ['carte', 'lieux'] })
      void queryClient.invalidateQueries({ queryKey: ['explorateur'] })
      void queryClient.invalidateQueries({ queryKey: cheminsKey })
    },
  })
  return {
    declarer: (souvenir: Souvenir) => mutation.mutateAsync(souvenir),
    enCours: mutation.isPending,
    erreur: mutation.isError ? messageDeRefus(mutation.error) : null,
  }
}
