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

  async function fetchRole(userId: string): Promise<UserRole | null> {
    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()
    return (data?.role as UserRole) ?? null
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const role = session?.user ? await fetchRole(session.user.id) : null
      setState({
        user: session?.user ?? null,
        session,
        role,
        loading: false
      })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const role = session?.user ? await fetchRole(session.user.id) : null
        setState({
          user: session?.user ?? null,
          session,
          role,
          loading: false
        })
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
    isAuthenticated: !!state.user,
    isAdmin: state.role === 'admin'
  }
}
