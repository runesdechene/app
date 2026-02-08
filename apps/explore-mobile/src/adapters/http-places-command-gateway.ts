import { JsonBody } from '@/shared/http/body/json-body'
import { IHttpClient } from '@/shared/http/http-client.interface'
import { HttpRequest } from '@/shared/http/http-request'
import {
  CreatePlacePayload,
  CreatePlaceResponse,
  IPlacesCommandGateway,
  UpdatePlacePayload,
} from '@ports'

export class HttpPlacesCommandGateway implements IPlacesCommandGateway {
  constructor(private readonly http: IHttpClient) {}

  createPlace(payload: CreatePlacePayload): Promise<CreatePlaceResponse> {
    return this.http.send(
      new HttpRequest({
        url: `places/create-place`,
        method: 'POST',
        body: new JsonBody(payload),
      }),
    )
  }

  updatePlace(payload: UpdatePlacePayload): Promise<void> {
    return this.http.send(
      new HttpRequest({
        url: `places/update-place`,
        method: 'POST',
        body: new JsonBody(payload),
      }),
    )
  }

  deletePlace(id: string): Promise<void> {
    return this.http.send(
      new HttpRequest({
        url: `places/delete-place`,
        method: 'DELETE',
        body: new JsonBody({
          id,
        }),
      }),
    )
  }

  async bookmarkPlace(id: string): Promise<void> {
    return this.http.send(
      new HttpRequest({
        url: `places/bookmark-place`,
        method: 'POST',
        body: new JsonBody({
          id,
        }),
      }),
    )
  }

  async removeBookmarkPlace(id: string): Promise<void> {
    return this.http.send(
      new HttpRequest({
        url: `places/remove-bookmark-place`,
        method: 'DELETE',
        body: new JsonBody({
          id,
        }),
      }),
    )
  }

  async likePlace(id: string): Promise<void> {
    return this.http.send(
      new HttpRequest({
        url: `places/like-place`,
        method: 'POST',
        body: new JsonBody({
          id,
        }),
      }),
    )
  }

  async removeLikePlace(id: string): Promise<void> {
    return this.http.send(
      new HttpRequest({
        url: `places/remove-like-place`,
        method: 'DELETE',
        body: new JsonBody({
          id,
        }),
      }),
    )
  }

  async explorePlace(id: string): Promise<void> {
    return this.http.send(
      new HttpRequest({
        url: `places/explore-place`,
        method: 'POST',
        body: new JsonBody({
          id,
        }),
      }),
    )
  }

  async removeExplorePlace(id: string): Promise<void> {
    return this.http.send(
      new HttpRequest({
        url: `places/remove-explore-place`,
        method: 'DELETE',
        body: new JsonBody({
          id,
        }),
      }),
    )
  }

  async viewPlace(id: string): Promise<void> {
    return this.http.send(
      new HttpRequest({
        url: `places/view-place`,
        method: 'POST',
        body: new JsonBody({
          id,
        }),
      }),
    )
  }
}
