import { ApiAuthenticatedUser } from '@model'

export type RegisterRequest = {
  password: string
  lastName: string
  gender: string
  emailAddress: string
  code: string | null
}

export type BeginPasswordResetRequest = {
  emailAddress: string
}

export type EndPasswordResetRequest = {
  code: string
  nextPassword: string
}

export interface ISessionGateway {
  signIn(emailAddress: string, password: string): Promise<ApiAuthenticatedUser>
  refreshAccessToken(refreshToken: string): Promise<ApiAuthenticatedUser>
  signOut(refreshToken: string): Promise<void>
  register(data: RegisterRequest): Promise<ApiAuthenticatedUser>
  beginPasswordReset(body: BeginPasswordResetRequest): Promise<void>
  endPasswordReset(body: EndPasswordResetRequest): Promise<void>
}
