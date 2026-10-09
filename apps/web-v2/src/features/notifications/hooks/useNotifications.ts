/**
 * QUOI     — les Notifications : la liste (le tiroir) et le nombre de non lues (la cloche), tenus à
 *            jour dès qu'une notification arrive.
 * POURQUOI — ouvrir le tiroir, c'est lire : la liste arrivée, tout passe lu en base et la cloche
 *            s'éteint. La liste garde son rose le temps de la visite — on n'écoute que les
 *            arrivées, pas le passage à « lu ».
 */
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ecouterNotifications,
  fetchNonLues,
  fetchNotifications,
  marquerLues,
} from '../api/notifications'

const notificationsKey = ['notifications'] as const
const nonLuesKey = [...notificationsKey, 'non-lues'] as const

function useEcoute() {
  const queryClient = useQueryClient()
  useEffect(
    () =>
      ecouterNotifications(() => {
        void queryClient.invalidateQueries({ queryKey: notificationsKey })
      }),
    [queryClient],
  )
}

export function useNonLues() {
  useEcoute()
  return useQuery({ queryKey: nonLuesKey, queryFn: fetchNonLues }).data ?? 0
}

export function useNotifications() {
  useEcoute()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: [...notificationsKey, 'liste'], queryFn: fetchNotifications })
  const { mutate: marquer } = useMutation({
    mutationFn: marquerLues,
    onSuccess: () => {
      queryClient.setQueryData(nonLuesKey, 0)
    },
  })
  const aLire = query.data?.some((n) => !n.lu) ?? false

  useEffect(() => {
    if (aLire) marquer()
  }, [aLire, marquer])

  return { notifications: query.data, erreur: query.isError, reessayer: query.refetch }
}
