import { PaginatedQuery, PaginatedResult } from '@/shared/api/pagination'
import { ApiIdResponse, ApiReview } from '@model'

export type CreateReviewPayload = {
  placeId: string
  score: number
  message: string
  imagesIds: string[]
  geocache: boolean
}

export type UpdateReviewPayload = {
  reviewId: string
  score: number
  message: string
  imagesIds: string[]
  geocache: boolean
}

export type DeleteReviewPayload = {
  reviewId: string
}

export type GetPlaceReviewsQuery = PaginatedQuery<{ placeId: string }>

export interface IReviewsGateway {
  // Commands
  createReview(payload: CreateReviewPayload): Promise<ApiIdResponse>
  updateReview(payload: UpdateReviewPayload): Promise<void>
  deleteReview(payload: DeleteReviewPayload): Promise<void>

  // Queries
  getPlaceReviews(
    query: GetPlaceReviewsQuery,
  ): Promise<PaginatedResult<ApiReview>>
  getReviewById(id: string): Promise<ApiReview>
}
