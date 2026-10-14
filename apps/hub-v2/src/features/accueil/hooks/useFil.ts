/**
 * QUOI     — le fil, page par page, filtré par types ; rafraîchi toutes les minutes.
 * POURQUOI — useInfiniteQuery de TanStack : la page suivante part de la dernière ligne reçue,
 *            et s'arrête quand une page revient incomplète (fin de l'historique) ou sans ligne nouvelle.
 */
import { useInfiniteQuery } from '@tanstack/react-query'
import { lireFil, PAGE, type Activite, type TypeActivite } from '../api/fil'

export function useFil(types: TypeActivite[]) {
  const requete = useInfiniteQuery({
    queryKey: ['hub-fil', types],
    queryFn: ({ pageParam }) => lireFil(types, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (derniere: Activite[], precedentes: Activite[][]) => {
      if (derniere.length < PAGE) return undefined
      // Garde-fou : une page qui n'apporte aucune ligne nouvelle (même instant sur plus d'une page) ne doit pas boucler.
      const dejaVues = new Set(precedentes.slice(0, -1).flat().map((a) => a.cle))
      if (derniere.every((a) => dejaVues.has(a.cle))) return undefined
      return derniere[derniere.length - 1]?.quand
    },
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
