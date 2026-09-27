/**
 * QUOI     — lit la session Supabase puis demande à la base si ce compte peut ouvrir la V2.
 * POURQUOI — traduit la réponse en AccessState pour decideAccess.
 * ATTENTION — `getSession()` lit la session stockée par la V1 (même origine, même clé) : c'est
 *            ce qui évite une seconde connexion. Pas de session → on ne demande rien à la base.
 *            Un jeton de rafraîchissement mort fait échouer has_v2_access : c'est un état
 *            `error`, et l'écran propose alors de réessayer ou de revenir à la V1.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/supabase/client'
import type { AccessState } from './decideAccess'

async function fetchAccess(): Promise<{ hasSession: boolean; hasAccess: boolean }> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionData.session) return { hasSession: false, hasAccess: false }

  const { data, error } = await supabase.rpc('has_v2_access')
  if (error) throw error
  return { hasSession: true, hasAccess: data }
}

export function useV2Access(): { state: AccessState; retry: () => void } {
  const query = useQuery({ queryKey: ['v2-access'], queryFn: fetchAccess, staleTime: Infinity })

  const retry = () => {
    void query.refetch()
  }

  if (query.isPending) return { state: { status: 'loading' }, retry }
  if (query.isError) return { state: { status: 'error' }, retry }
  return { state: { status: 'ready', ...query.data }, retry }
}
