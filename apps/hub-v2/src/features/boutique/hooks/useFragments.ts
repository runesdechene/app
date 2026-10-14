/**
 * QUOI     — les lectures de l'écran Fragments (Fragments, scans, inventaire Shopify) et l'ajout d'un Fragment.
 * POURQUOI — l'inventaire Shopify ne se rejoue pas tout seul en cas d'échec (retry: false) : la panne
 *            s'affiche, et chaque clic sur « Synchroniser » est une nouvelle tentative. Les cultures
 *            viennent de shared/cultures.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ajouterFragment, lireFragments } from '../api/fragments'
import { lireScans } from '../api/scan'
import { lireIllustrations, type Illustration } from '../api/shopify'

export function useFragments() {
  return useQuery({ queryKey: ['hub-fragments'], queryFn: lireFragments })
}

export function useScans() {
  return useQuery({ queryKey: ['hub-scans'], queryFn: lireScans })
}

export function useIllustrations() {
  return useQuery({ queryKey: ['hub-illustrations'], queryFn: lireIllustrations, retry: false })
}

export function useAjouterFragment() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (motif: Illustration) => ajouterFragment(motif),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['hub-fragments'] }),
        client.invalidateQueries({ queryKey: ['hub-scans'] }),
      ])
    },
  })
}
