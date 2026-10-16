/**
 * QUOI     — qui voit le scanner : les admins seulement, tant que les motifs ne sont pas filmés.
 * POURQUOI — sans vue du vrai t-shirt, le scanner ne compare la caméra qu'à l'illustration et se
 *            trompe sur un vêtement (Uriel, 16/10). Passer SCANNER_OUVERT_A_TOUS à true le rouvre à
 *            tous (l'icône et /scan), le jour où le Hub ne montre plus de Fragment « À filmer ».
 * ATTENTION — null tant que la session se lit : sans lui, un admin qui ouvre /scan serait renvoyé à
 *            l'accueil avant qu'on sache qui il est.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchMoi } from '@/features/lieu/api/lieu'

export const SCANNER_OUVERT_A_TOUS: boolean = false

/** Admin ? Lu une fois, sans nouvel essai : sans session, la réponse « non » tombe aussitôt. */
export function useScannerAdmin(): boolean | null {
  const moi = useQuery({ queryKey: ['scanner', 'admin'], queryFn: fetchMoi, staleTime: Infinity, retry: false })
  return moi.isPending ? null : (moi.data?.admin ?? false)
}

export function useScannerVisible(): boolean | null {
  const admin = useScannerAdmin()
  return SCANNER_OUVERT_A_TOUS ? true : admin
}
