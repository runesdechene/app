/**
 * QUOI     — le scanner est ouvert à tous ; seul un admin y voit la feuille « Apprendre cette vue ».
 * ATTENTION — null tant que la session se lit.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchMoi } from '@/features/lieu/api/lieu'

/** Admin ? Lu une fois, sans nouvel essai : sans session, la réponse « non » tombe aussitôt. */
export function useScannerAdmin(): boolean | null {
  const moi = useQuery({
    queryKey: ['scanner', 'admin'],
    queryFn: fetchMoi,
    staleTime: Infinity,
    retry: false,
  })
  return moi.isPending ? null : (moi.data?.admin ?? false)
}
