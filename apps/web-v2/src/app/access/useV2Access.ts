/**
 * QUOI     — lit la session Supabase puis demande à la base si ce compte peut ouvrir la V2.
 * POURQUOI — traduit la réponse en AccessState pour decideAccess.
 * ATTENTION — `getSession()` lit la session stockée par la V1 (même origine, même clé) : c'est
 *            ce qui évite une seconde connexion. Pas de session → on ne demande rien à la base.
 *            Un jeton de rafraîchissement mort fait échouer has_v2_access : c'est un état
 *            `error`, et l'écran propose alors de réessayer ou de revenir à la V1.
 *            Délai de ACCESS_TIMEOUT_MS : hors connexion, supabase-js peut réessayer pendant des
 *            dizaines de secondes ; au-delà du délai, on bascule en `error` plutôt qu'attendre.
 *            L'accès accordé est gardé sur l'appareil (queryClient) : hors ligne, il ouvre la V2 ;
 *            un accès retiré se voit à la prochaine ouverture en ligne.
 *            Connexion ou déconnexion (y compris dans un onglet V1) → la vérification est refaite.
 *            Une entrée autorisée met à jour la dernière connexion (touch_last_login), comme la V1 ;
 *            un retour dans l'app aussi, après dix minutes ailleurs (`retours.ts`) : c'est ce que
 *            « vient de se connecter » raconte dans le Registre.
 *            Un e-mail changé (USER_UPDATED) est recopié dans `users`, et les autres sessions
 *            fermées, comme le faisait la V1.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/shared/supabase/client'
import { oublierLeCache } from '../queryClient'
import type { AccessState } from './decideAccess'
import { compterLesRetours } from './retours'

export const ACCESS_TIMEOUT_MS = 8000
export const ACCESS_KEY = ['v2-access']

async function fetchAccess(): Promise<{ hasSession: boolean; hasAccess: boolean }> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionData.session) return { hasSession: false, hasAccess: false }

  const { data, error } = await supabase.rpc('has_v2_access')
  if (error) throw error
  if (data) noterLaConnexion(sessionData.session.user.id)
  return { hasSession: true, hasAccess: data }
}

async function recopierLEmail(userId: string, email: string) {
  await supabase.from('users').update({ email_address: email }).eq('id', userId)
  await supabase.auth.signOut({ scope: 'others' })
}

// La dernière connexion (l'en-tête d'un Murmure, le Registre, le Hub la lisent) : sans attendre,
// sans bloquer. Une requête supabase-js ne part que lorsqu'on l'attend : `.then()` l'envoie (sans
// lui, la dernière connexion est restée figée depuis le passage à la V2).
function noterLaConnexion(userId: string) {
  void supabase.rpc('touch_last_login', { p_user_id: userId }).then()
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
  const queryClient = useQueryClient()

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // L'e-mail vient de changer : la fiche le recopie, et les autres sessions sont fermées —
      // ce que faisait la V1 (useAuth), qui disparaît à la bascule.
      if (event === 'USER_UPDATED' && session?.user.email) {
        void recopierLEmail(session.user.id, session.user.email)
      }
      // Déconnecté (ici ou dans un onglet V1) : le cache de la session, et sa copie, s'effacent.
      if (event === 'SIGNED_OUT') oublierLeCache()
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        void queryClient.invalidateQueries({ queryKey: ACCESS_KEY })
      }
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }, [queryClient])

  const query = useQuery({
    queryKey: ACCESS_KEY,
    queryFn: () => withTimeout(fetchAccess(), ACCESS_TIMEOUT_MS),
    // Relu à chaque ouverture (un accès retiré se voit), mais une copie gardée suffit à ouvrir :
    // hors ligne, la relecture échoue et la copie fait foi.
    staleTime: 0,
    networkMode: 'offlineFirst',
  })

  // Revenir dans l'app compte comme l'ouvrir — seulement une fois entré.
  const autorise = query.data?.hasAccess === true
  useEffect(() => {
    if (!autorise) return
    return compterLesRetours(() => {
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) noterLaConnexion(data.session.user.id)
      })
    })
  }, [autorise])

  const retry = () => {
    void query.refetch()
  }

  if (query.data) return { state: { status: 'ready', ...query.data }, retry }
  if (query.isPending) return { state: { status: 'loading' }, retry }
  return { state: { status: 'error' }, retry }
}
