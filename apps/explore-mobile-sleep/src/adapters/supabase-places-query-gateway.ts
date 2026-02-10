import { ApiTotalPlaces } from '@/model/api-total-places'
import { supabase } from '@/shared/supabase/client'
import { ApiPlaceDetail, ApiPlaceType } from '@model'
import { ChildPlaceTypesQuery, IPlacesQueryGateway } from '@ports'

export class SupabasePlacesQueryGateway implements IPlacesQueryGateway {
  constructor(private readonly getUserId: () => string | null) {}

  async getRootPlaceTypes(): Promise<ApiPlaceType[]> {
    const { data, error } = await supabase
      .from('place_types')
      .select('*')
      .is('parent_id', null)
      .order('order', { ascending: true })

    if (error) throw error
    return (data ?? []).map(this.mapPlaceType)
  }

  async getChildPlaceTypes(
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

  async getPlaceById(placeId: string): Promise<ApiPlaceDetail> {
    const { data, error } = await supabase.rpc('get_place_by_id', {
      p_id: placeId,
      p_user_id: this.getUserId(),
    })

    if (error) throw error
    if (data?.error) throw new Error(data.error)
    return data as ApiPlaceDetail
  }

  async getTotalPlaces(): Promise<ApiTotalPlaces> {
    const { count, error } = await supabase
      .from('places')
      .select('*', { count: 'exact', head: true })

    if (error) throw error
    return { count: count ?? 0 }
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
