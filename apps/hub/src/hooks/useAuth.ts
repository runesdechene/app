import { useState, useEffect, useRef } from 'react'
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
  const initialised = useRef(false)

  useEffect(() => {
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

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const role = session?.user?.email ? await fetchRole(session.user.email) : null
        setState({ user: session?.user ?? null, session, role, loading: false })
      } catch {
        setState(prev => ({ ...prev, loading: false }))
      }
      initialised.current = true
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!initialised.current) return
        const role = session?.user?.email ? await fetchRole(session.user.email) : null
        setState({ user: session?.user ?? null, session, role, loading: false })
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
