/**
 * QUOI     — lit la session Supabase puis demande à la base si ce compte peut ouvrir la V2.
 * POURQUOI — traduit la réponse en AccessState pour decideAccess.
 * ATTENTION — `getSession()` lit la session stockée par la V1 (même origine, même clé) : c'est
 *            ce qui évite une seconde connexion. Pas de session → on ne demande rien à la base.
 *            Un jeton de rafraîchissement mort fait échouer has_v2_access : c'est un état
 *            `error`, et l'écran propose alors de réessayer ou de revenir à la V1.
 *            Délai de ACCESS_TIMEOUT_MS : hors connexion, supabase-js peut réessayer pendant des
 *            dizaines de secondes ; au-delà du délai, on bascule en `error` plutôt qu'attendre.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/supabase/client'
import type { AccessState } from './decideAccess'

export const ACCESS_TIMEOUT_MS = 8000

async function fetchAccess(): Promise<{ hasSession: boolean; hasAccess: boolean }> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionData.session) return { hasSession: false, hasAccess: false }

  const { data, error } = await supabase.rpc('has_v2_access')
  if (error) throw error
  return { hasSession: true, hasAccess: data }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Vérification d'accès sans réponse après ${String(ms)} ms`))
    }, ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (reason: unknown) => {
        clearTimeout(timer)
        reject(reason instanceof Error ? reason : new Error(String(reason)))
      },
    )
  })
}

export function useV2Access(): { state: AccessState; retry: () => void } {
  const query = useQuery({
    queryKey: ['v2-access'],
    queryFn: () => withTimeout(fetchAccess(), ACCESS_TIMEOUT_MS),
    staleTime: Infinity,
  })

  const retry = () => {
    void query.refetch()
  }

  if (query.isPending) return { state: { status: 'loading' }, retry }
  if (query.isError) return { state: { status: 'error' }, retry }
  return { state: { status: 'ready', ...query.data }, retry }
}
