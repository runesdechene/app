import z from 'zod';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ForbiddenException, Inject } from '@nestjs/common';

import { BaseCommand } from '../../../libs/shared/command.js';
import {
  I_REVIEW_REPOSITORY,
  IReviewRepository,
} from '../../ports/repositories/review-repository.js';

type Payload = {
  reviewId: string;
};

export class DeleteReviewCommand extends BaseCommand<Payload> {
  validate(props: Payload) {
    return z
      .object({
        reviewId: z.string(),
      })
      .parse(props);
  }
}

@CommandHandler(DeleteReviewCommand)
export class DeleteReviewCommandHandler
  implements ICommandHandler<DeleteReviewCommand>
{
  constructor(
    @Inject(I_REVIEW_REPOSITORY)
    private readonly reviewRepository: IReviewRepository,
  ) {}

  async execute(command: DeleteReviewCommand) {
    const props = command.props();

    const review = await this.reviewRepository
      .byId(props.reviewId)
      .then((o) => o.getOrThrow());

    if (!command.auth().IsOwnerOrAdmin(review.user.id)) {
      throw new ForbiddenException();
    }

    await this.reviewRepository.delete(review);
  }
}
