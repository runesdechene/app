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

export type GetUserPlacesQuery = PaginatedQuery<{ userId: string }>

export interface IPlacesFeedGateway {
  getRegularFeed(
    query: GetRegularFeedQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>>
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
