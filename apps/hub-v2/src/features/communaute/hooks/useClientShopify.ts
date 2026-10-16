/**
 * QUOI     — ce que la boutique sait d'un client (commandes, dépense, dernière commande en ligne).
 */
import { useQuery } from '@tanstack/react-query'
import { lireClientShopify } from '../api/clientShopify'

export function useClientShopify(email: string | null) {
  return useQuery({
    queryKey: ['hub-client-shopify', email],
    queryFn: () => lireClientShopify(email ?? ''),
    enabled: email !== null,
    retry: false,
  })
}
