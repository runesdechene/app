/**
 * QUOI     — les notifications sur ce téléphone : ce qu'il permet, s'il est abonné, et le geste
 *            pour s'abonner ou se désabonner.
 * POURQUOI — la ligne « Sur ce téléphone » des Préférences. L'abonnement se lit sur le
 *            téléphone lui-même (le service worker), pas en base : un autre appareil peut l'être.
 * ATTENTION — un refus (permission refusée, réseau) laisse l'interrupteur à sa vraie place et
 *            passe `echec` à vrai : jamais un interrupteur qui ment.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { abonner, desabonner, estAbonne, pushDeCeTelephone } from '../lib/push'

const CLE = ['push-ce-telephone'] as const

export function usePush() {
  const queryClient = useQueryClient()
  const permis = pushDeCeTelephone()
  const abonne = useQuery({
    queryKey: CLE,
    queryFn: estAbonne,
    enabled: permis === 'possible',
  })
  const changer = useMutation({
    mutationFn: (oui: boolean) => (oui ? abonner() : desabonner()),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CLE }),
  })
  return {
    permis,
    abonne: abonne.data === true,
    changer: (oui: boolean) => {
      changer.mutate(oui)
    },
    enCours: changer.isPending,
    echec: changer.isError,
  }
}
