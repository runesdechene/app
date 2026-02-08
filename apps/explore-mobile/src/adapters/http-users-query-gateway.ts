import { IHttpClient } from '@/shared/http/http-client.interface'
import { HttpRequest } from '@/shared/http/http-request'
import { ApiUserProfile } from '@model'
import { IUsersQueryGateway } from '@ports'

export class HttpUsersQueryGateway implements IUsersQueryGateway {
  constructor(private readonly http: IHttpClient) {}

  async getUserProfile(userId: string): Promise<ApiUserProfile> {
    return this.http.send(
      new HttpRequest({
        url: `users/get-user-profile?id=${userId}`,
        method: 'GET',
      }),
    )
  }
}
