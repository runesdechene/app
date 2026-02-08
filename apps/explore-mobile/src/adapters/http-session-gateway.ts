import { JsonBody } from '@/shared/http/body/json-body'
import { IHttpClient } from '@/shared/http/http-client.interface'
import { HttpRequest } from '@/shared/http/http-request'
import { ApiAuthenticatedUser } from '@model'
import {
  BeginPasswordResetRequest,
  ISessionGateway,
  RegisterRequest,
} from '@ports'

export class HttpSessionGateway implements ISessionGateway {
  constructor(private readonly http: IHttpClient) {}

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<ApiAuthenticatedUser> {
    return this.http.send(
      new HttpRequest({
        url: 'auth/login-with-refresh-token',
        method: 'POST',
        body: new JsonBody({ value: refreshToken }),
      }),
    )
  }

  async signIn(
    emailAddress: string,
    password: string,
  ): Promise<ApiAuthenticatedUser> {
    return this.http.send(
      new HttpRequest({
        url: 'auth/login-with-credentials',
        method: 'POST',
        body: new JsonBody({ emailAddress, password }),
      }),
    )
  }

  async register(data: RegisterRequest): Promise<ApiAuthenticatedUser> {
    return this.http.send<ApiAuthenticatedUser>(
      new HttpRequest({
        method: 'POST',
        url: '/auth/register',
        body: new JsonBody(data),
      }),
    )
  }

  async signOut(refreshToken: string): Promise<void> {
    return
  }

  async beginPasswordReset(body: BeginPasswordResetRequest): Promise<void> {
    return this.http.send(
      new HttpRequest({
        method: 'POST',
        url: '/auth/begin-password-reset',
        body: new JsonBody(body),
      }),
    )
  }

  async endPasswordReset(body: {
    code: string
    nextPassword: string
  }): Promise<void> {
    return this.http.send(
      new HttpRequest({
        method: 'POST',
        url: '/auth/end-password-reset',
        body: new JsonBody(body),
      }),
    )
  }
}
