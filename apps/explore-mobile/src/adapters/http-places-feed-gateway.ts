import { PaginatedResult } from '@/shared/api/pagination'
import { JsonBody } from '@/shared/http/body/json-body'
import { IHttpClient } from '@/shared/http/http-client.interface'
import { HttpRequest } from '@/shared/http/http-request'
import { ApiPlaceMap, ApiPlaceSummary } from '@model'
import {
  GetBannerFeedQuery,
  GetMapBannersQuery,
  GetMapPlacesQuery,
  GetRegularFeedQuery,
  GetUserPlacesQuery,
  IPlacesFeedGateway,
} from '@ports'

export class HttpPlacesFeedGateway implements IPlacesFeedGateway {
  constructor(private readonly http: IHttpClient) {}

  async getBannerFeed(
    query: GetBannerFeedQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>> {
    return this.http.send(
      new HttpRequest({
        url: 'places/get-banner-feed',
        method: 'POST',
        body: new JsonBody(query),
      }),
    )
  }

  async getRegularFeed(
    query: GetRegularFeedQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>> {
    return this.http.send(
      new HttpRequest({
        url: 'places/get-regular-feed',
        method: 'POST',
        body: new JsonBody(query),
      }),
    )
  }

  async getMapBanners(query: GetMapBannersQuery): Promise<ApiPlaceMap[]> {
    return this.http.send(
      new HttpRequest({
        url: 'places/get-map-banners',
        method: 'POST',
        body: new JsonBody(query),
      }),
    )
  }

  async getMapPlaces(query: GetMapPlacesQuery): Promise<ApiPlaceMap[]> {
    return this.http.send(
      new HttpRequest({
        url: 'places/get-map-places',
        method: 'POST',
        body: new JsonBody(query),
      }),
    )
  }

  async getLikedPlaces(
    query: GetUserPlacesQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>> {
    return this.http.send(
      new HttpRequest({
        url: 'places/get-liked-places',
        method: 'POST',
        body: new JsonBody(query),
      }),
    )
  }

  async getExploredPlaces(
    query: GetUserPlacesQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>> {
    return this.http.send(
      new HttpRequest({
        url: 'places/get-explored-places',
        method: 'POST',
        body: new JsonBody(query),
      }),
    )
  }

  async getBookmarkedPlaces(
    query: GetUserPlacesQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>> {
    return this.http.send(
      new HttpRequest({
        url: 'places/get-bookmarked-places',
        method: 'POST',
        body: new JsonBody(query),
      }),
    )
  }

  async getAddedPlaces(
    query: GetUserPlacesQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>> {
    return this.http.send(
      new HttpRequest({
        url: 'places/get-added-places',
        method: 'POST',
        body: new JsonBody(query),
      }),
    )
  }
}
