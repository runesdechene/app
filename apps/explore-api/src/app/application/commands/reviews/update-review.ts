import z from 'zod';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ForbiddenException, Inject } from '@nestjs/common';

import { BaseCommand } from '../../../libs/shared/command.js';
import {
  I_REVIEW_REPOSITORY,
  IReviewRepository,
} from '../../ports/repositories/review-repository.js';
import { ref } from '@mikro-orm/core';
import { ImageMedia } from '../../../domain/entities/image-media.js';

type Payload = {
  reviewId: string;
  score: number;
  message: string;
  imagesIds: string[];
  geocache?: boolean;
};

export class UpdateReviewCommand extends BaseCommand<Payload> {
  validate(props: Payload) {
    return z
      .object({
        reviewId: z.string(),
        score: z.number().int().min(1).max(5),
        message: z.string().min(0).max(1000),
        imagesIds: z.array(z.string()),
        geocache: z.boolean().optional(),
      })
      .parse(props);
  }
}

@CommandHandler(UpdateReviewCommand)
export class UpdateReviewCommandHandler
  implements ICommandHandler<UpdateReviewCommand>
{
  constructor(
    @Inject(I_REVIEW_REPOSITORY)
    private readonly reviewRepository: IReviewRepository,
  ) {}

  async execute(command: UpdateReviewCommand) {
    const props = command.props();

    const review = await this.reviewRepository
      .byId(props.reviewId)
      .then((o) => o.getOrThrow());

    if (!command.auth().IsOwnerOrAdmin(review.user.id)) {
      throw new ForbiddenException();
    }

    review.score = props.score;
    review.message = props.message;
    review.geocache = props.geocache ?? false;

    review.images.removeAll();
    props.imagesIds.forEach((imageId) => {
      review.images.add(ref(ImageMedia, imageId));
    });

    await this.reviewRepository.save(review);
  }
}
