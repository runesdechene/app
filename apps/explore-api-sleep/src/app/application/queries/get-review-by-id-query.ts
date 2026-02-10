import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EntityManager } from '@mikro-orm/postgresql';
import z from 'zod';
import { BaseCommand } from '../../libs/shared/command.js';
import { ApiReview } from '../viewmodels/api-review.js';
import { Review } from '../../domain/entities/review.js';
import { NotFoundException } from '../../libs/exceptions/not-found-exception.js';
import { ReviewVmMapper } from '../../libs/places/review-vm-mapper.js';

type Payload = {
  id: string;
};

export class GetReviewByIdQuery extends BaseCommand<Payload> {
  validate(props: Payload): Payload {
    return z
      .object({
        id: z.string(),
      })
      .parse(props);
  }
}

@QueryHandler(GetReviewByIdQuery)
export class GetReviewByIdQueryHandler
  implements IQueryHandler<GetReviewByIdQuery, ApiReview>
{
  private viewMapper = new ReviewVmMapper();

  constructor(private readonly em: EntityManager) {}

  async execute(query: GetReviewByIdQuery): Promise<ApiReview> {
    const review = await this.em
      .createQueryBuilder(Review)
      .leftJoinAndSelect('user', 'u')
      .leftJoinAndSelect('u.profileImageId', 'ui')
      .leftJoinAndSelect('images', 'i')
      .where({ id: query.props().id })
      .getSingleResult();

    if (!review) {
      throw new NotFoundException();
    }

    return this.viewMapper.toViewModel(review);
  }
}
