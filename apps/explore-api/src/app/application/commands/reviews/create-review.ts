import z from 'zod';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';

import { BaseCommand } from '../../../libs/shared/command.js';
import {
  I_PLACE_REPOSITORY,
  IPlaceRepository,
} from '../../ports/repositories/place-repository.js';
import {
  I_REVIEW_REPOSITORY,
  IReviewRepository,
} from '../../ports/repositories/review-repository.js';
import {
  I_ID_PROVIDER,
  IIdProvider,
} from '../../ports/services/id-provider.interface.js';
import { Review } from '../../../domain/entities/review.js';
import { User } from '../../../domain/entities/user.js';
import { ref } from '@mikro-orm/core';
import { Place } from '../../../domain/entities/place.js';
import { ImageMedia } from '../../../domain/entities/image-media.js';
import { RandomIdProvider } from '../../../../adapters/for-production/services/random-id-provider.js';

type Payload = {
  placeId: string;
  score: number;
  message: string;
  imagesIds: string[];
  geocache?: boolean;
};

export class CreateReviewCommand extends BaseCommand<Payload> {
  validate(props: Payload) {
    return z
      .object({
        placeId: z.string(),
        score: z.number().min(1).max(5),
        message: z.string().min(0).max(1000),
        imagesIds: z.array(z.string()),
        geocache: z.boolean().optional(),
      })
      .parse(props);
  }
}

@CommandHandler(CreateReviewCommand)
export class CreateReviewCommandHandler
  implements ICommandHandler<CreateReviewCommand, { id: string }>
{
  constructor(
    @Inject(I_ID_PROVIDER)
    private readonly idProvider: IIdProvider,
    @Inject(I_PLACE_REPOSITORY)
    private readonly placeRepository: IPlaceRepository,
    @Inject(I_REVIEW_REPOSITORY)
    private readonly reviewRepository: IReviewRepository,
  ) {}

  async execute(command: CreateReviewCommand) {
    const props = command.props();

    const place = await this.placeRepository
      .byId(props.placeId)
      .then((o) => o.getOrThrow());

    const review = new Review({
      id: RandomIdProvider.getId(),
      user: ref(User, command.auth().id()),
      place: ref(Place, place.id),
      score: props.score,
      message: props.message,
      geocache: props.geocache ?? false,
    });

    props.imagesIds.forEach((imageId) => {
      review.images.add(ref(ImageMedia, imageId));
    });

    await this.reviewRepository.save(review);

    return {
      id: review.id,
    };
  }
}
