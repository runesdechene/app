/**
 * QUOI     — les trois lectures des Écoutes : les écoutes (base), l'inventaire audio et les produits sans
 *            Illustration (Shopify).
 * POURQUOI — trois requêtes indépendantes : Shopify en panne ne cache pas les écoutes, et chaque relevé
 *            dit son propre état. Pas de nouvel essai pour Shopify : une portée refusée ne s'arrange pas seule.
 */
import { useQuery } from '@tanstack/react-query'
import { lireEcoutes } from '../api/ecoutes'
import { lireInventaireAudio, lireProduitsSansIllustration } from '../api/shopify'

export function useEcoutes() {
  return useQuery({ queryKey: ['hub-ecoutes'], queryFn: lireEcoutes })
}

export function useInventaireAudio() {
  return useQuery({ queryKey: ['hub-inventaire-audio'], queryFn: lireInventaireAudio, retry: false })
}

export function useProduitsSansIllustration() {
  return useQuery({ queryKey: ['hub-produits-sans-illustration'], queryFn: lireProduitsSansIllustration, retry: false })
}
