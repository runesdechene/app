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

// Le role admin est porte par le JWT via app_metadata.user_role, pose par un trigger
// public.users.role -> auth.users (migration 179). On lit le role de facon SYNCHRONE
// depuis la session — aucune requete DB de gating (fini le bug recurrent "User not admin"
// et l'ecran "Chargement..." infini : plus aucun await dans le callback onAuthStateChange).
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
    let ready = false

    function apply(session: Session | null) {
      if (!active) return
      setState({ user: session?.user ?? null, session, role: roleFromSession(session), loading: false })
    }

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      // Transition : une session emise avant la migration n'a pas encore le claim user_role.
      // Un seul refresh (hors callback) pour obtenir un token frais qui le porte.
      if (session?.user && !session.user.app_metadata?.user_role) {
        const { data: { session: refreshed } } = await supabase.auth.refreshSession()
        apply(refreshed ?? session)
      } else {
        apply(session)
      }
      ready = true
    }

    init()

    // Synchrone : aucun await/requete ici. init() assure le premier rendu (et le refresh
    // de transition) ; ensuite ce callback gere login / logout / refresh.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!ready) return
      apply(session)
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
    isAdmin: state.role === 'admin',
  }
}
