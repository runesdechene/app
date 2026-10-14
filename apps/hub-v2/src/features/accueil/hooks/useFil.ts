/**
 * QUOI     — le fil, page par page, filtré par types ; rafraîchi toutes les minutes.
 * POURQUOI — useInfiniteQuery de TanStack : la page suivante part de la dernière ligne reçue,
 *            et s'arrête quand une page revient incomplète (fin de l'historique).
 */
import { useInfiniteQuery } from '@tanstack/react-query'
import { lireFil, PAGE, type Activite, type TypeActivite } from '../api/fil'

export function useFil(types: TypeActivite[]) {
  const requete = useInfiniteQuery({
    queryKey: ['hub-fil', types],
    queryFn: ({ pageParam }) => lireFil(types, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (derniere: Activite[]) => (derniere.length < PAGE ? undefined : derniere[derniere.length - 1]?.quand),
    refetchInterval: 60_000,
  })
  // La page suivante reprend la dernière ligne de la précédente (curseur inclusif) : on garde la première.
  const activites = [...new Map((requete.data?.pages.flat() ?? []).map((a) => [a.cle, a])).values()]
  return {
    activites,
    voirPlus: () => void requete.fetchNextPage(),
    aDAutres: requete.hasNextPage,
    isError: requete.isError,
  }
}
