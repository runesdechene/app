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

// Le role admin est porte par le JWT via app_metadata.user_role, pose par le trigger
// public.users.role -> auth.users (migration 179). Lecture SYNCHRONE depuis la session :
// aucune requete DB, aucun await dans le chemin de gating. loading se resout TOUJOURS
// (getSession OU evenement INITIAL_SESSION OU filet de securite) — jamais de blocage.
function roleFromSession(session: Session | null): UserRole | null {
  const r = session?.user?.app_metadata?.user_role
  return (r as UserRole) ?? null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    loading: true,
  })

  useEffect(() => {
    let active = true

    const apply = (session: Session | null) => {
      if (!active) return
      setState({ user: session?.user ?? null, session, role: roleFromSession(session), loading: false })
    }

    // 1) Lecture initiale (resout loading des qu'elle revient ; tolere une erreur).
    supabase.auth.getSession()
      .then(({ data: { session } }) => apply(session))
      .catch(() => { if (active) setState(s => ({ ...s, loading: false })) })

    // 2) Login / logout / refresh — SYNCHRONE (aucun await ici -> pas de deadlock).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => apply(session))

    // 3) Filet anti-blocage : si rien n'a resolu en 4s, on debloque (au pire -> LoginPage).
    const safety = setTimeout(() => {
      if (active) setState(s => (s.loading ? { ...s, loading: false } : s))
    }, 4000)

    return () => { active = false; clearTimeout(safety); subscription.unsubscribe() }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return {
    ...state,
    signOut,
    isAuthenticated: !!state.user,
    isAdmin: state.role === 'admin',
  }
}
