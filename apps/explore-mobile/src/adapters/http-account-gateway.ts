import { JsonBody } from '@/shared/http/body/json-body'
import { IHttpClient } from '@/shared/http/http-client.interface'
import { HttpRequest } from '@/shared/http/http-request'
import { ApiMyInformations } from '@model'
import {
  ActivateAccountRequestModel,
  ChangeEmailAddressRequestModel,
  ChangeInformationsRequestModel,
  ChangePasswordRequestModel,
  IAccountGateway,
} from '@ports'

export class HttpAccountGateway implements IAccountGateway {
  constructor(private readonly http: IHttpClient) {}

  async deleteAccount(): Promise<any> {
    return await this.http.send(
      new HttpRequest({
        method: 'DELETE',
        url: '/auth/delete-account',
      }),
    )
  }

  async getMyUser(): Promise<ApiMyInformations> {
    return await this.http.send(
      new HttpRequest({
        method: 'GET',
        url: '/auth/get-my-informations',
      }),
    )
  }

  async changePassword(data: ChangePasswordRequestModel): Promise<void> {
    return await this.http.send(
      new HttpRequest({
        method: 'POST',
        url: '/auth/change-password',
        body: new JsonBody(data),
      }),
    )
  }

  async changeInformations(
    data: ChangeInformationsRequestModel,
  ): Promise<void> {
    return await this.http.send(
      new HttpRequest({
        method: 'POST',
        url: '/auth/change-informations',
        body: new JsonBody(data),
      }),
    )
  }

  async changeEmailAddress(
    data: ChangeEmailAddressRequestModel,
  ): Promise<void> {
    return await this.http.send(
      new HttpRequest({
        method: 'POST',
        url: '/auth/change-email-address',
        body: new JsonBody(data),
      }),
    )
  }

  async activateAccount(data: ActivateAccountRequestModel): Promise<void> {
    return await this.http.send(
      new HttpRequest({
        method: 'POST',
        url: '/auth/activate-account',
        body: new JsonBody(data),
      }),
    )
  }
}
