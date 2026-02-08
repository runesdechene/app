import { ApiAdminStats } from '@/model/api-admin-stats'
import { supabase } from '@/shared/supabase/client'
import { ApiPlaceType } from '@model'
import { IAdminQueryGateway } from '@ports'
import { ChildPlaceTypesQuery } from '@/ports/places-query-gateway'

export class SupabaseAdminQueryGateway implements IAdminQueryGateway {
  async getStats(): Promise<ApiAdminStats> {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString()

    const [
      usersRes,
      usersLast30Res,
      usersLast7Res,
      androidRes,
      appleRes,
      placesRes,
      placesLast30Res,
      reviewsRes,
      reviewsLast30Res,
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('last_access', thirtyDaysAgo),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('last_access', sevenDaysAgo),
      supabase.from('users').select('*', { count: 'exact', head: true }).ilike('last_device_os', '%android%'),
      supabase.from('users').select('*', { count: 'exact', head: true }).ilike('last_device_os', '%ios%'),
      supabase.from('places').select('*', { count: 'exact', head: true }),
      supabase.from('places').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
      supabase.from('reviews').select('*', { count: 'exact', head: true }),
      supabase.from('reviews').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    ])

    const nbUsers = usersRes.count ?? 0
    const nbAndroid = androidRes.count ?? 0
    const nbApple = appleRes.count ?? 0

    return {
      nbUsers,
      nbUsersConnectedLast30Days: usersLast30Res.count ?? 0,
      nbUsersSignInLast7Days: usersLast7Res.count ?? 0,
      nbUsersAndroid: nbAndroid,
      nbUsersApple: nbApple,
      nbUsersOthers: nbUsers - nbAndroid - nbApple,
      nbPlaces: placesRes.count ?? 0,
      nbPlacesAddedLast30Days: placesLast30Res.count ?? 0,
      nbReviews: reviewsRes.count ?? 0,
      nbReviewsAddedLast30Days: reviewsLast30Res.count ?? 0,
    }
  }

  async getAdminRootPlaceTypes(): Promise<ApiPlaceType[]> {
    const { data, error } = await supabase
      .from('place_types')
      .select('*')
      .is('parent_id', null)
      .order('order', { ascending: true })

    if (error) throw error
    return (data ?? []).map(this.mapPlaceType)
  }

  async getAdminChildPlaceTypes(
    query: ChildPlaceTypesQuery,
  ): Promise<ApiPlaceType[]> {
    const { data, error } = await supabase
      .from('place_types')
      .select('*')
      .eq('parent_id', query.parentId)
      .order('order', { ascending: true })

    if (error) throw error
    return (data ?? []).map(this.mapPlaceType)
  }

  private mapPlaceType(row: any): ApiPlaceType {
    return {
      id: row.id,
      title: row.title,
      imageUrl: row.images?.regular ?? '',
      color: row.color,
      background: row.background,
      border: row.border,
      fadedColor: row.faded_color,
      order: row.order,
      root: !row.parent_id,
      images: row.images ?? {},
      parent: row.parent_id ?? undefined,
      hidden: row.hidden,
    }
  }
}
