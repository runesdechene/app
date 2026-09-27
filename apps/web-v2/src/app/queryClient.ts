/**
 * QUOI     — l'instance TanStack Query partagée par toute l'app.
 * POURQUOI — un seul cache : deux écrans qui demandent la même donnée ne la chargent qu'une fois.
 */
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
})
