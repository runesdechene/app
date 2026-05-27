import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

type UserRole = 'user' | 'ambassador' | 'moderator' | 'admin'

interface AuthState {
  user: User | null
  session: Session | null
  role: UserRole | null
  loading: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    loading: true
  })
  useEffect(() => {
    let active = true

    async function fetchRole(email: string): Promise<UserRole | null> {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('email_address', email)
          .single()
        if (error) {
          console.error('[useAuth] fetchRole error:', error.message)
          return null
        }
        return (data?.role as UserRole) ?? null
      } catch (e) {
        console.error('[useAuth] fetchRole exception:', e)
        return null
      }
    }

    // IMPORTANT : ne JAMAIS await un appel Supabase directement dans le callback
    // onAuthStateChange — ça deadlock le verrou auth (la requete pend jusqu'au timeout
    // -> role null -> faux "pas admin"). On differe hors du callback via setTimeout(0).
    function applySession(session: Session | null) {
      setTimeout(async () => {
        if (!active) return
        const email = session?.user?.email
        const role = email ? await fetchRole(email) : null
        if (active) setState({ user: session?.user ?? null, session, role, loading: false })
      }, 0)
    }

    supabase.auth.getSession().then(({ data: { session } }) => { if (active) applySession(session) })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session)
    })

    return () => { active = false; subscription.unsubscribe() }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return {
    ...state,
    signOut,
    isAuthenticated: !!state.user,
    isAdmin: state.role === 'admin'
  }
}
