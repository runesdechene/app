import { PaginatedResult } from '@/shared/api/pagination'
import { supabase } from '@/shared/supabase/client'
import { ApiIdResponse, ApiReview } from '@model'
import {
  CreateReviewPayload,
  DeleteReviewPayload,
  GetPlaceReviewsQuery,
  IReviewsGateway,
  UpdateReviewPayload,
} from '@ports'
import { customAlphabet } from 'nanoid/non-secure'

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 21)

export class SupabaseReviewsGateway implements IReviewsGateway {
  constructor(private readonly getUserId: () => string | null) {}

  async createReview(payload: CreateReviewPayload): Promise<ApiIdResponse> {
    const id = nanoid()
    const userId = this.getUserId()
    if (!userId) throw new Error('Not authenticated')

    const { error } = await supabase.from('reviews').insert({
      id,
      user_id: userId,
      place_id: payload.placeId,
      score: payload.score,
      message: payload.message,
      geocache: payload.geocache,
    })

    if (error) throw error

    // Link images
    if (payload.imagesIds.length > 0) {
      const { error: imgError } = await supabase
        .from('reviews_images')
        .insert(
          payload.imagesIds.map((imageId) => ({
            review_id: id,
            image_media_id: imageId,
          })),
        )

      if (imgError) throw imgError
    }

    return { id }
  }

  async updateReview(payload: UpdateReviewPayload): Promise<void> {
    const { error } = await supabase
      .from('reviews')
      .update({
        score: payload.score,
        message: payload.message,
        geocache: payload.geocache,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.reviewId)

    if (error) throw error

    // Replace images: delete old, insert new
    await supabase
      .from('reviews_images')
      .delete()
      .eq('review_id', payload.reviewId)

    if (payload.imagesIds.length > 0) {
      const { error: imgError } = await supabase
        .from('reviews_images')
        .insert(
          payload.imagesIds.map((imageId) => ({
            review_id: payload.reviewId,
            image_media_id: imageId,
          })),
        )

      if (imgError) throw imgError
    }
  }

  async deleteReview(payload: DeleteReviewPayload): Promise<void> {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', payload.reviewId)

    if (error) throw error
  }

  async getPlaceReviews(
    query: GetPlaceReviewsQuery,
  ): Promise<PaginatedResult<ApiReview>> {
    const { data, error } = await supabase.rpc('get_place_reviews', {
      p_place_id: query.params!.placeId,
      p_page: query.page ?? 1,
      p_count: query.count ?? 10,
    })

    if (error) throw error
    return data as PaginatedResult<ApiReview>
  }

  async getReviewById(id: string): Promise<ApiReview> {
    const { data, error } = await supabase.rpc('get_review_by_id', {
      p_id: id,
    })

    if (error) throw error
    if (data?.error) throw new Error(data.error)
    return data as ApiReview
  }
}
