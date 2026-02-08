import { BaseCommand } from '../../../libs/shared/command.js';
import z from 'zod';
import { CommandHandler } from '@nestjs/cqrs';
import { RandomIdProvider } from '../../../../adapters/for-production/services/random-id-provider.js';
import { EntityManager } from '@mikro-orm/postgresql';
import { PlaceBaseCommandHandler } from '../../../libs/places/place-base-command-handler.js';
import { Inject } from '@nestjs/common';
import {
  I_PLACE_LIKED_REPOSITORY,
  IPlaceLikedRepository,
} from '../../ports/repositories/place-liked-repository.js';
import { PlaceLiked } from '../../../domain/entities/place-liked.js';
import { Place } from '../../../domain/entities/place.js';
import { ref } from '@mikro-orm/core';
import { User } from '../../../domain/entities/user.js';

export class LikePlaceCommand extends BaseCommand<{ id: string }> {
  validate(props) {
    return z
      .object({
        id: z.string(),
      })
      .parse(props);
  }
}

@CommandHandler(LikePlaceCommand)
export class LikePlaceCommandHandler extends PlaceBaseCommandHandler {
  constructor(
    em: EntityManager,
    @Inject(I_PLACE_LIKED_REPOSITORY)
    private readonly repository: IPlaceLikedRepository,
  ) {
    super(em);
  }

  async execute(command: LikePlaceCommand) {
    const { id } = command.props();
    const auth = command.auth();

    const place = await this.getPlaceOrThrow(id);

    const likeQuery = await this.repository.byUserAndPlace(auth.id(), place.id);
    if (likeQuery.isPresent()) {
      return;
    }

    const liked = new PlaceLiked();
    liked.id = RandomIdProvider.getId();
    liked.user = ref(User, auth.id());
    liked.place = ref(Place, place.id);

    await this.repository.save(liked);
  }
}
