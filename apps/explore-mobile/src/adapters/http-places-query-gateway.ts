import { ApiTotalPlaces } from '@/model/api-total-places'
import { IHttpClient } from '@/shared/http/http-client.interface'
import { HttpRequest } from '@/shared/http/http-request'
import { ApiPlaceDetail, ApiPlaceType } from '@model'
import { ChildPlaceTypesQuery, IPlacesQueryGateway } from '@ports'

export class HttpPlacesQueryGateway implements IPlacesQueryGateway {
  constructor(private readonly http: IHttpClient) {}

  async getRootPlaceTypes(): Promise<ApiPlaceType[]> {
    return this.http.send(
      new HttpRequest({
        url: `places/get-root-place-types`,
        method: 'GET',
      }),
    )
  }

  async getChildPlaceTypes(
    query: ChildPlaceTypesQuery,
  ): Promise<ApiPlaceType[]> {
    return this.http.send(
      new HttpRequest({
        url: `places/get-children-place-types?parentId=${query.parentId}`,
        method: 'GET',
      }),
    )
  }

  async getPlaceById(placeId: string): Promise<ApiPlaceDetail> {
    return this.http.send(
      new HttpRequest({
        url: `places/get-place-by-id?id=${placeId}`,
        method: 'GET',
      }),
    )
  }

  async getTotalPlaces(): Promise<ApiTotalPlaces> {
    return this.http.send(
      new HttpRequest({
        url: 'places/get-total-places',
        method: 'GET',
      }),
    )
  }
}
