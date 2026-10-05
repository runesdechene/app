/**
 * QUOI     — mes Compagnies, qui sont autant de canaux de La Communauté (migration 422).
 * POURQUOI — rejoindre ou quitter une Compagnie change les gélules : la zone Compagnies relit la clé
 *            partagée `canauxKey` après chacun de ces gestes.
 */
import { useQuery } from '@tanstack/react-query'
import { canauxKey } from '@/shared/lib/cles'
import { fetchCanaux } from '@/shared/supabase/canaux'

export type { CanalCompagnie } from '@/shared/supabase/canaux'

export function useCanaux() {
  const q = useQuery({ queryKey: canauxKey, queryFn: fetchCanaux })
  return { compagnies: q.data ?? [], pret: q.data !== undefined || q.isError }
}
