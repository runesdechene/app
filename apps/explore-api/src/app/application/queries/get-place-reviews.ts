import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EntityManager } from '@mikro-orm/postgresql';
import z from 'zod';

import {
  PaginatedQuery,
  PaginatedResult,
} from '../../libs/shared/pagination.js';
import { BaseCommand } from '../../libs/shared/command.js';
import { ApiReview } from '../viewmodels/api-review.js';
import { Review } from '../../domain/entities/review.js';
import { BadRequestException } from '../../libs/exceptions/bad-request-exception.js';
import { ReviewVmMapper } from '../../libs/places/review-vm-mapper.js';

export class GetPlaceReviewsQuery extends BaseCommand<
  PaginatedQuery<{ placeId: string }>
> {
  validate(props) {
    return z
      .object({
        params: z.object({
          placeId: z.string(),
        }),
        page: z.number().optional(),
        count: z.number().max(100).min(1).optional(),
      })
      .parse(props);
  }
}

@QueryHandler(GetPlaceReviewsQuery)
export class GetPlaceReviewsQueryHandler
  implements IQueryHandler<GetPlaceReviewsQuery, PaginatedResult<ApiReview>>
{
  private viewMapper = new ReviewVmMapper();

  constructor(private readonly entityManager: EntityManager) {}

  async execute(
    query: GetPlaceReviewsQuery,
  ): Promise<PaginatedResult<ApiReview>> {
    const props = query.props();

    if (!props.params?.placeId) {
      throw new BadRequestException({
        code: 'PLACE_ID_REQUIRED',
        message: 'Place ID is required',
      });
    }
    const page = props.page ?? 1;
    const count = props.count ?? 10;
    const start = page * count - count;

    const result = await this.entityManager
      .createQueryBuilder(Review)
      .leftJoinAndSelect('user', 'u')
      .leftJoinAndSelect('u.profileImageId', 'ui')
      .leftJoinAndSelect('images', 'i')
      .where({ place: props.params.placeId })
      .limit(count)
      .offset(start)
      .getResult();

    const total = await this.entityManager
      .createQueryBuilder(Review)
      .where({ place: props.params.placeId })
      .count();

    return {
      data: result.map((result) => this.viewMapper.toViewModel(result)),
      meta: {
        page,
        count,
        total,
      },
    };
  }
}
