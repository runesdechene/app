/**
 * QUOI     — la santé de la boutique pour « La santé » : Shopify (rafraîchi toutes les 5 min, comme l'ancien
 *            badge) et la date de reconstruction des fiches publiques.
 * POURQUOI — la panne de la fonction Netlify elle-même devient un message (shopifyErreur), pas un écran vide.
 */
import { useQuery } from '@tanstack/react-query'
import { lireFichesPubliques, lireSanteShopify } from '../api/sante'

export function useSanteBoutique() {
  const shopify = useQuery({
    queryKey: ['hub-sante-shopify'],
    queryFn: lireSanteShopify,
    refetchInterval: 5 * 60_000,
    retry: false,
  })
  const fiches = useQuery({ queryKey: ['hub-fiches-publiques'], queryFn: lireFichesPubliques })
  return {
    shopify: shopify.data,
    shopifyErreur: shopify.error ? shopify.error.message : null,
    fiches: fiches.data,
  }
}
