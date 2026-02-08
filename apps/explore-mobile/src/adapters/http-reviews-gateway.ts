import { PaginatedResult } from '@/shared/api/pagination'
import { JsonBody } from '@/shared/http/body/json-body'
import { IHttpClient } from '@/shared/http/http-client.interface'
import { HttpRequest } from '@/shared/http/http-request'
import { ApiIdResponse, ApiReview } from '@model'
import {
  CreateReviewPayload,
  DeleteReviewPayload,
  GetPlaceReviewsQuery,
  IReviewsGateway,
  UpdateReviewPayload,
} from '@ports'

export class HttpReviewsGateway implements IReviewsGateway {
  constructor(private readonly http: IHttpClient) {}

  async createReview(payload: CreateReviewPayload): Promise<ApiIdResponse> {
    return this.http.send(
      new HttpRequest({
        url: 'reviews/create-review',
        method: 'POST',
        body: new JsonBody(payload),
      }),
    )
  }

  async updateReview(payload: UpdateReviewPayload): Promise<void> {
    return this.http.send(
      new HttpRequest({
        url: 'reviews/update-review',
        method: 'POST',
        body: new JsonBody(payload),
      }),
    )
  }

  async deleteReview(payload: DeleteReviewPayload): Promise<void> {
    return this.http.send(
      new HttpRequest({
        url: 'reviews/delete-review',
        method: 'DELETE',
        body: new JsonBody(payload),
      }),
    )
  }

  async getReviewById(reviewId: string): Promise<ApiReview> {
    return this.http.send(
      new HttpRequest({
        url: `reviews/get-review-by-id?id=${reviewId}`,
        method: 'GET',
      }),
    )
  }

  async getPlaceReviews(
    query: GetPlaceReviewsQuery,
  ): Promise<PaginatedResult<ApiReview>> {
    return this.http.send(
      new HttpRequest({
        url: 'reviews/get-place-reviews',
        method: 'POST',
        body: new JsonBody(query),
      }),
    )
  }
}
