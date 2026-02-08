import { ApiAdminStats } from '@/model/api-admin-stats'
import { IHttpClient } from '@/shared/http/http-client.interface'
import { HttpRequest } from '@/shared/http/http-request'
import { ApiPlaceType } from '@model'
import { ChildPlaceTypesQuery, IAdminQueryGateway } from '@ports'

export class HttpAdminQueryGateway implements IAdminQueryGateway {
  constructor(private readonly http: IHttpClient) {}

  async getStats(): Promise<ApiAdminStats> {
    return this.http.send(
      new HttpRequest({
        url: `admin/auth/stats`,
        method: 'GET',
      }),
    )
  }

  async getAdminRootPlaceTypes(): Promise<ApiPlaceType[]> {
    return this.http.send(
      new HttpRequest({
        url: `admin/auth/get-admin-root-place-types`,
        method: 'GET',
      }),
    )
  }

  async getAdminChildPlaceTypes(
    query: ChildPlaceTypesQuery,
  ): Promise<ApiPlaceType[]> {
    return this.http.send(
      new HttpRequest({
        url: `admin/auth/get-admin-children-place-types?parentId=${query.parentId}`,
        method: 'GET',
      }),
    )
  }
}
