/**
 * QUOI     — le calendrier où s'affichent les dates, et le moyen d'en changer.
 * POURQUOI — la clé `['preferences', 'calendrier']` suit le contrat des Préférences (voir
 *            useLieuxEnCouleur) : changer de calendrier réécrit aussitôt toutes les dates à
 *            l'écran. Tant qu'il n'est pas lu, ou sans compte : chrétien, le défaut de la base.
 * ATTENTION — le choix s'affiche avant la réponse de la base ; refusé, la relecture remet le
 *            vrai, et `echec` permet de le dire.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Calendrier } from '@runes/calendrier'
import { lireCalendrier, reglerCalendrier } from '../lib/calendrierDuCompte'

const CLE = ['preferences', 'calendrier']

export function useCalendrier(): Calendrier {
  return useQuery({ queryKey: CLE, queryFn: lireCalendrier }).data ?? 'chretien'
}

export function useChoisirCalendrier() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: reglerCalendrier,
    onMutate: async (calendrier: Calendrier) => {
      await queryClient.cancelQueries({ queryKey: CLE })
      queryClient.setQueryData(CLE, calendrier)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CLE }),
  })
  return { choisir: mutation.mutate, enCours: mutation.isPending, echec: mutation.isError }
}
