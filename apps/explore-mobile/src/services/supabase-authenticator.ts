import { Listener, ObservableValue } from '@/shared/lib/observable-value'
import { IStorage } from '@/shared/ports/storage/storage'
import { supabase } from '@/shared/supabase/client'
import { Nullable } from '@/shared/types'
import { AuthData } from '@model'

export type SignInCredentials = { emailAddress: string; password: string }

export class SupabaseAuthenticator {
  private user = new ObservableValue<Nullable<AuthData>>(null)

  constructor(private readonly storage: IStorage) {}

  async initialize() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session) {
      const authData = this.sessionToAuthData(session)
      this.user.set(authData)
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (session) {
        const authData = this.sessionToAuthData(session)
        this.user.set(authData)
      } else {
        this.user.set(null)
      }
    })
  }

  async signIn(credentials: SignInCredentials) {
    const { error } = await supabase.auth.signInWithPassword({
      email: credentials.emailAddress,
      password: credentials.password,
    })

    if (error) throw error
    // onAuthStateChange will update the user
  }

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    this.user.set(null)
  }

  onUserChange(listener: Listener<Nullable<AuthData>>) {
    return this.user.addListener(listener)
  }

  async maintainValidAccessToken() {
    // Supabase handles token refresh automatically via autoRefreshToken
    // We just check if the session is still valid
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      this.user.set(null)
    }
  }

  async refreshUser(): Promise<void> {
    const { data, error } = await supabase.auth.refreshSession()

    if (error) {
      console.error('Failed to refresh the user', error)
      return
    }

    if (data.session) {
      const authData = this.sessionToAuthData(data.session)
      this.user.set(authData)
    }
  }

  async onRegistered() {
    // Supabase Auth handles this via onAuthStateChange
    // Nothing extra needed
  }

  getUserId(): string | null {
    return this.user.get()?.user.id ?? null
  }

  private sessionToAuthData(session: {
    access_token: string
    refresh_token: string
    expires_at?: number
    user: { id: string; email?: string; user_metadata?: any }
  }): AuthData {
    const user = session.user
    const now = new Date()

    const expiresAt = session.expires_at
      ? new Date(session.expires_at * 1000)
      : new Date(now.getTime() + 3600 * 1000)

    const refreshExpiresAt = new Date(
      now.getTime() + 7 * 24 * 3600 * 1000,
    )

    return {
      user: {
        id: user.id,
        emailAddress: user.email ?? '',
        lastName: user.user_metadata?.last_name ?? '',
        profileImage: user.user_metadata?.profile_image ?? null,
        role: user.user_metadata?.role ?? 'user',
        rank: user.user_metadata?.rank ?? 'guest',
      },
      accessToken: {
        value: session.access_token,
        expiresAt,
      },
      refreshToken: {
        value: session.refresh_token,
        expiresAt: refreshExpiresAt,
      },
    }
  }
}
