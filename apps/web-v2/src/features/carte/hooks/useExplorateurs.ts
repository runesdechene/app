/**
 * QUOI     — les Explorateurs dont le nom commence par ce qu'on tape dans la recherche de la carte.
 * POURQUOI — la carte ne connaît que les lieux ; les membres se demandent à la base, une fois la
 *            frappe posée et deux lettres tapées. Rien pour un visiteur sans compte (`actif`).
 */
import { useQuery } from '@tanstack/react-query'
import { usePose } from '@/shared/hooks/usePose'
import { fetchExplorateurs } from '../api/carte'

export function useExplorateurs(texte: string, actif: boolean) {
  const debut = usePose(texte.trim(), 250)
  const query = useQuery({
    queryKey: ['carte', 'explorateurs', debut],
    queryFn: () => fetchExplorateurs(debut),
    enabled: actif && debut.length >= 2,
  })
  return actif && texte.trim().length >= 2 ? (query.data ?? []) : []
}
