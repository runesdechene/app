import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({
        user: session?.user ?? null,
        session,
        loading: false
      })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setState({
          user: session?.user ?? null,
          session,
          loading: false
        })

        // Synchroniser email_address dans la table users apres un changement d'email
        // + deconnecter toutes les autres sessions (anti-piratage)
        if (event === 'USER_UPDATED' && session?.user?.email) {
          supabase
            .from('users')
            .update({ email_address: session.user.email })
            .eq('id', session.user.id)
            .then(() => {})
          supabase.auth.signOut({ scope: 'others' }).then(() => {})
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return {
    ...state,
    signOut,
    isAuthenticated: !!state.user
  }
}
