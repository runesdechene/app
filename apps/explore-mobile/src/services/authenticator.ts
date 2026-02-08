import { HttpAuthentication } from '@/shared/http/http-authentication'
import { IHttpClient } from '@/shared/http/http-client.interface'
import { Listener, ObservableValue } from '@/shared/lib/observable-value'
import { IDateProvider } from '@/shared/ports/date/date-provider'
import { IStorage } from '@/shared/ports/storage/storage'
import { Nullable } from '@/shared/types'
import { ApiAuthenticatedUser, AuthData } from '@model'
import { ISessionGateway } from '@ports'

export type SignInCredentials = { emailAddress: string; password: string }

export class Authenticator {
  private user = new ObservableValue<Nullable<AuthData>>(null)

  constructor(
    private readonly gateway: ISessionGateway,
    private readonly storage: IStorage,
    private readonly httpClient: IHttpClient,
    private readonly dateProvider: IDateProvider,
  ) {}

  async initialize() {
    const raw = await this.storage.getItem('auth')

    const serializedUser: ApiAuthenticatedUser | null = raw
      ? JSON.parse(raw)
      : null
    const user = serializedUser ? this.toSelfUser(serializedUser) : null

    if (!user) {
      return null
    }

    const freshUser = await this.ensureFreshUser(user)
    if (!freshUser) {
      return null
    }

    await this.storeUser(freshUser)
  }

  async signIn(credentials: SignInCredentials) {
    const apiUser = await this.gateway.signIn(
      credentials.emailAddress,
      credentials.password,
    )

    const user = this.toSelfUser(apiUser)
    await this.storeUser(user)
  }

  async signOut() {
    if (this.user.get()) {
      // Clear the refresh token
      const user = this.user.get()!
      await this.gateway.signOut(user!.refreshToken.value)
    }

    await this.storage.removeItem('auth')
    this.user.set(null)
  }

  onUserChange(listener: Listener<Nullable<AuthData>>) {
    return this.user.addListener(listener)
  }

  async maintainValidAccessToken() {
    const user = this.user.get()
    if (user === null) {
      return
    }

    const freshUser = await this.ensureFreshUser(user)
    await this.storeUser(freshUser!)
  }

  async refreshUser(): Promise<void> {
    const savedUser = this.user.get()
    if (!savedUser) {
      return
    }

    try {
      const freshUser = await this.gateway.refreshAccessToken(
        savedUser.refreshToken.value,
      )

      const user = this.toSelfUser(freshUser)
      await this.storeUser(user)
    } catch (e) {
      // Silently fail and un-authenticate the user
      console.error('Failed to refresh the user', e)
    }
  }

  async onRegistered(user: ApiAuthenticatedUser) {
    const selfUser = this.toSelfUser(user)
    await this.storeUser(selfUser)
  }

  private toSelfUser(apiUser: ApiAuthenticatedUser): AuthData {
    return {
      user: {
        id: apiUser.user.id,
        emailAddress: apiUser.user.emailAddress,
        lastName: apiUser.user.lastName,
        profileImage: apiUser.user.profileImage,
        role: apiUser.user.role,
        rank: apiUser.user.rank,
      },
      accessToken: {
        value: apiUser.accessToken.value,
        expiresAt: new Date(apiUser.accessToken.expiresAt),
      },
      refreshToken: {
        value: apiUser.refreshToken.value,
        expiresAt: new Date(apiUser.refreshToken.expiresAt),
      },
    }
  }

  private authenticateHttpClient(user: AuthData) {
    this.httpClient.setAuthentication(
      new HttpAuthentication(user.accessToken.value),
    )
  }

  /**
   * Ensure the user is fresh
   * A fresh user is a user whose access token is still valid
   * If the token is not valid, we refresh it
   * If the refresh fails, we un-authenticate the user
   * @param user
   * @private
   */
  private async ensureFreshUser(user: AuthData): Promise<Nullable<AuthData>> {
    const accessTokenExpiresAt = user.accessToken.expiresAt
    const delta = Math.floor(
      (accessTokenExpiresAt.getTime() - this.dateProvider.now().getTime()) /
        1000,
    )

    if (delta >= 60) {
      return user
    }

    try {
      const freshUser = await this.gateway.refreshAccessToken(
        user.refreshToken.value,
      )

      return this.toSelfUser(freshUser)
    } catch (e) {
      // Silently fail and un-authenticate the user
      console.error('Failed to re-authenticate the user', e)

      await this.storage.removeItem('auth')
      return null
    }
  }

  private async storeUser(user: AuthData) {
    await this.storage.setItem('auth', JSON.stringify(user))
    this.user.set(user)
    this.authenticateHttpClient(user!)
  }
}
