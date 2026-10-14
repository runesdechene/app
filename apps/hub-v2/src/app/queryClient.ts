/**
 * QUOI     — le cache de données du Hub.
 * POURQUOI — TanStack Query, comme la V2 ; rien n'est gardé sur l'appareil (un back-office lit
 *            toujours la base fraîche), une donnée a 30 s de fraîcheur.
 */
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})
