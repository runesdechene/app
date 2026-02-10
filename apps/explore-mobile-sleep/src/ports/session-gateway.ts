import { ApiAuthenticatedUser } from '@model'

export interface ISessionGateway {
  refreshAccessToken(refreshToken: string): Promise<ApiAuthenticatedUser>
  signOut(refreshToken: string): Promise<void>
}
