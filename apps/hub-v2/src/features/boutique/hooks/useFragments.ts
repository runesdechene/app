/**
 * QUOI     — les lectures de l'écran Fragments (Fragments, scans, inventaire Shopify), l'ajout d'un Fragment
 *            et les écritures de sa fiche (enregistrer, recalculer les empreintes, retirer une vue).
 * POURQUOI — l'inventaire Shopify ne se rejoue pas tout seul en cas d'échec (retry: false) : la panne
 *            s'affiche, et chaque clic sur « Synchroniser » est une nouvelle tentative. Les cultures
 *            viennent de shared/cultures.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ajouterFragment, enregistrerFragment, lireFragments, type Fragment, type FragmentAEcrire } from '../api/fragments'
import { lireScans, recalculerEmpreintes, retirerEmpreinte } from '../api/scan'
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
    // onSettled : si l'ajout a réussi mais pas la synchro de son motif, la liste se rafraîchit quand même.
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['hub-fragments'] }),
        client.invalidateQueries({ queryKey: ['hub-scans'] }),
      ])
    },
  })
}

// Une fiche enregistrée rafraîchit la liste (les lignes montrent l'origine) et la fiche elle-même.
export function useEcritureFragment(id: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (f: Omit<FragmentAEcrire, 'id'>) => enregistrerFragment({ id, ...f }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['hub-fragments'] }),
  })
}

export function useRecalculerEmpreintes() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (f: Pick<Fragment, 'id' | 'illustration_url' | 'illustration_sombre_url'>) => recalculerEmpreintes(f),
    onSuccess: () => client.invalidateQueries({ queryKey: ['hub-scans'] }),
  })
}

export function useRetirerEmpreinte() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => retirerEmpreinte(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['hub-scans'] }),
  })
}
