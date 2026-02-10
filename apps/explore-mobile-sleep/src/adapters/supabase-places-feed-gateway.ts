import { PaginatedResult } from '@/shared/api/pagination'
import { supabase } from '@/shared/supabase/client'
import { ApiPlaceMap, ApiPlaceSummary } from '@model'
import {
  GetBannerFeedQuery,
  GetMapBannersQuery,
  GetMapPlacesQuery,
  GetRegularFeedQuery,
  GetUserPlacesQuery,
  IPlacesFeedGateway,
} from '@ports'

export class SupabasePlacesFeedGateway implements IPlacesFeedGateway {
  constructor(private readonly getUserId: () => string | null) {}

  async getRegularFeed(
    query: GetRegularFeedQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>> {
    const params = query.params ?? { type: 'latest' as const }
    const { data, error } = await supabase.rpc('get_regular_feed', {
      p_type: params.type,
      p_latitude: 'latitude' in params ? params.latitude : null,
      p_longitude: 'longitude' in params ? params.longitude : null,
      p_page: query.page ?? 1,
      p_count: query.count ?? 10,
      p_user_id: this.getUserId(),
    })

    if (error) throw error
    return data as PaginatedResult<ApiPlaceSummary>
  }

  async getBannerFeed(
    query: GetBannerFeedQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>> {
    const params = query.params ?? { type: 'latest' as const }
    const { data, error } = await supabase.rpc('get_banner_feed', {
      p_type: params.type,
      p_page: query.page ?? 1,
      p_count: query.count ?? 10,
      p_user_id: this.getUserId(),
    })

    if (error) throw error
    return data as PaginatedResult<ApiPlaceSummary>
  }

  async getMapPlaces(query: GetMapPlacesQuery): Promise<ApiPlaceMap[]> {
    const params = query.params ?? { type: 'all' as const }
    const { data, error } = await supabase.rpc('get_map_places', {
      p_type: params.type,
      p_latitude: 'latitude' in params ? params.latitude ?? null : null,
      p_longitude: 'longitude' in params ? params.longitude ?? null : null,
      p_latitude_delta:
        'latitudeDelta' in params ? params.latitudeDelta ?? null : null,
      p_longitude_delta:
        'longitudeDelta' in params ? params.longitudeDelta ?? null : null,
      p_limit: 'count' in params ? params.count : 100,
      p_user_id: this.getUserId(),
    })

    if (error) throw error
    return (data ?? []) as ApiPlaceMap[]
  }

  async getMapBanners(query: GetMapBannersQuery): Promise<ApiPlaceMap[]> {
    const params = query.params
    const { data, error } = await supabase.rpc('get_map_banners', {
      p_latitude: params?.latitude ?? null,
      p_longitude: params?.longitude ?? null,
      p_latitude_delta: params?.latitudeDelta ?? null,
      p_longitude_delta: params?.longitudeDelta ?? null,
      p_user_id: this.getUserId(),
    })

    if (error) throw error
    return (data ?? []) as ApiPlaceMap[]
  }

  async getLikedPlaces(
    query: GetUserPlacesQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>> {
    return this.getUserPlaces(query, 'liked')
  }

  async getBookmarkedPlaces(
    query: GetUserPlacesQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>> {
    return this.getUserPlaces(query, 'bookmarked')
  }

  async getExploredPlaces(
    query: GetUserPlacesQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>> {
    return this.getUserPlaces(query, 'explored')
  }

  async getAddedPlaces(
    query: GetUserPlacesQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>> {
    return this.getUserPlaces(query, 'added')
  }

  private async getUserPlaces(
    query: GetUserPlacesQuery,
    listType: string,
  ): Promise<PaginatedResult<ApiPlaceSummary>> {
    const { data, error } = await supabase.rpc('get_user_places', {
      p_user_id: query.params!.userId,
      p_list_type: listType,
      p_page: query.page ?? 1,
      p_count: query.count ?? 10,
      p_requester_id: this.getUserId(),
    })

    if (error) throw error
    return data as PaginatedResult<ApiPlaceSummary>
  }
}
