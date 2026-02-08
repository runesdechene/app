import { PaginatedQuery, PaginatedResult } from '@/shared/api/pagination'
import { ApiPlaceMap, ApiPlaceSummary } from '@model'

export type GetRegularFeedQueryParams =
  | {
      type: 'latest'
    }
  | {
      type: 'closest'
      latitude: number
      longitude: number
    }
  | {
      type: 'popular'
    }

export type GetRegularFeedQuery = PaginatedQuery<GetRegularFeedQueryParams>
export type GetRegularFeedType = GetRegularFeedQueryParams['type']

export type GetMapPlacesQuery = PaginatedQuery<
  | {
      type: 'all'
      latitude?: number
      longitude?: number
      latitudeDelta?: number
      longitudeDelta?: number
    }
  | {
      type: 'latest'
      count: number
    }
  | {
      type: 'popular'
      count: number
    }
>

export type GetMapBannersQuery = PaginatedQuery<{
  type: 'all'
  latitude?: number
  longitude?: number
  latitudeDelta?: number
  longitudeDelta?: number
}>

export type GetBannerFeedQuery = PaginatedQuery<
  | {
      type: 'latest'
    }
  | {
      type: 'all'
    }
>

export type GetUserPlacesQuery = PaginatedQuery<{ userId: string }>

export interface IPlacesFeedGateway {
  getBannerFeed(
    query: GetBannerFeedQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>>
  getRegularFeed(
    query: GetRegularFeedQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>>
  getMapBanners(query: GetMapBannersQuery): Promise<ApiPlaceMap[]>
  getMapPlaces(query: GetMapPlacesQuery): Promise<ApiPlaceMap[]>
  getLikedPlaces(
    query: GetUserPlacesQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>>
  getBookmarkedPlaces(
    query: GetUserPlacesQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>>
  getExploredPlaces(
    query: GetUserPlacesQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>>
  getAddedPlaces(
    query: GetUserPlacesQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>>
}
