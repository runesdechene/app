import { supabase } from '@/shared/supabase/client'
import { ApiAuthenticatedUser } from '@model'
import { ISessionGateway } from '@ports'

export class SupabaseSessionGateway implements ISessionGateway {
  async refreshAccessToken(
    _refreshToken: string,
  ): Promise<ApiAuthenticatedUser> {
    const { data, error } = await supabase.auth.refreshSession()

    if (error) throw error
    if (!data.session || !data.user) throw new Error('No session after refresh')

    return this.mapSession(data as any)
  }

  async signOut(_refreshToken: string): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  private mapSession(data: {
    session: {
      access_token: string
      refresh_token: string
      expires_at?: number
    }
    user: { id: string; email?: string; user_metadata?: any }
  }): ApiAuthenticatedUser {
    const session = data.session
    const user = data.user
    const now = new Date().toISOString()

    const expiresAt = session.expires_at
      ? new Date(session.expires_at * 1000).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString()

    const refreshExpiresAt = new Date(
      Date.now() + 7 * 24 * 3600 * 1000,
    ).toISOString()

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
        issuedAt: now,
        expiresAt,
      },
      refreshToken: {
        value: session.refresh_token,
        issuedAt: now,
        expiresAt: refreshExpiresAt,
      },
    }
  }
}
