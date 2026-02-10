import { supabase } from '@/shared/supabase/client'
import {
  CreatePlacePayload,
  CreatePlaceResponse,
  IPlacesCommandGateway,
  UpdatePlacePayload,
} from '@ports'
import { customAlphabet } from 'nanoid/non-secure'

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 21)

export class SupabasePlacesCommandGateway implements IPlacesCommandGateway {
  constructor(private readonly getUserId: () => string | null) {}

  async createPlace(payload: CreatePlacePayload): Promise<CreatePlaceResponse> {
    const id = nanoid()
    const userId = this.getUserId()
    if (!userId) throw new Error('Not authenticated')

    const { error } = await supabase.from('places').insert({
      id,
      author_id: userId,
      place_type_id: payload.placeTypeId,
      title: payload.title,
      text: payload.text,
      address: '',
      latitude: payload.location.latitude,
      longitude: payload.location.longitude,
      private: payload.private,
      masked: false,
      images: payload.images,
      accessibility: payload.accessibility ?? null,
      sensible: payload.sensible,
      begin_at: payload.beginAt?.toISOString() ?? null,
      end_at: payload.endAt?.toISOString() ?? null,
    })

    if (error) throw error
    return { id }
  }

  async updatePlace(payload: UpdatePlacePayload): Promise<void> {
    const { error } = await supabase
      .from('places')
      .update({
        place_type_id: payload.placeTypeId,
        title: payload.title,
        text: payload.text,
        latitude: payload.location.latitude,
        longitude: payload.location.longitude,
        private: payload.private,
        images: payload.images,
        accessibility: payload.accessibility ?? null,
        sensible: payload.sensible,
        begin_at: payload.beginAt?.toISOString() ?? null,
        end_at: payload.endAt?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.id)

    if (error) throw error
  }

  async deletePlace(placeId: string): Promise<void> {
    const { error } = await supabase.from('places').delete().eq('id', placeId)
    if (error) throw error
  }

  async bookmarkPlace(placeId: string): Promise<void> {
    const userId = this.getUserId()
    if (!userId) throw new Error('Not authenticated')

    const { error } = await supabase.from('places_bookmarked').insert({
      id: nanoid(),
      user_id: userId,
      place_id: placeId,
    })

    if (error && error.code !== '23505') throw error // ignore duplicate
  }

  async removeBookmarkPlace(placeId: string): Promise<void> {
    const userId = this.getUserId()
    if (!userId) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('places_bookmarked')
      .delete()
      .eq('user_id', userId)
      .eq('place_id', placeId)

    if (error) throw error
  }

  async likePlace(placeId: string): Promise<void> {
    const userId = this.getUserId()
    if (!userId) throw new Error('Not authenticated')

    const { error } = await supabase.from('places_liked').insert({
      id: nanoid(),
      user_id: userId,
      place_id: placeId,
    })

    if (error && error.code !== '23505') throw error
  }

  async removeLikePlace(placeId: string): Promise<void> {
    const userId = this.getUserId()
    if (!userId) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('places_liked')
      .delete()
      .eq('user_id', userId)
      .eq('place_id', placeId)

    if (error) throw error
  }

  async explorePlace(placeId: string): Promise<void> {
    const userId = this.getUserId()
    if (!userId) throw new Error('Not authenticated')

    const { error } = await supabase.from('places_explored').insert({
      id: nanoid(),
      user_id: userId,
      place_id: placeId,
    })

    if (error && error.code !== '23505') throw error
  }

  async removeExplorePlace(placeId: string): Promise<void> {
    const userId = this.getUserId()
    if (!userId) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('places_explored')
      .delete()
      .eq('user_id', userId)
      .eq('place_id', placeId)

    if (error) throw error
  }

  async viewPlace(placeId: string): Promise<void> {
    const userId = this.getUserId()
    if (!userId) return // silent fail for anonymous

    const { error } = await supabase.from('places_viewed').insert({
      id: nanoid(),
      user_id: userId,
      place_id: placeId,
    })

    if (error) console.warn('Failed to record view', error)
  }
}
