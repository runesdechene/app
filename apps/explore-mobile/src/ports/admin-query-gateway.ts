import { ApiAdminStats } from '@/model/api-admin-stats'
import { BannerFeedQueryParams } from '@/queries/use-banner-feed-query'
import { PaginatedQuery } from '@/shared/api/pagination'
import { ApiPlaceType } from '@model'
import { ChildPlaceTypesQuery } from './places-query-gateway'

export type GetBannerFeedQuery = PaginatedQuery<BannerFeedQueryParams>

export interface IAdminQueryGateway {
  getStats(): Promise<ApiAdminStats>
  getAdminRootPlaceTypes(): Promise<ApiPlaceType[]>
  getAdminChildPlaceTypes(query: ChildPlaceTypesQuery): Promise<ApiPlaceType[]>
}
