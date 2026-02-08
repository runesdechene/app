import { BaseCommand } from '../../../libs/shared/command.js';
import z from 'zod';
import { CommandHandler } from '@nestjs/cqrs';
import { EntityManager } from '@mikro-orm/postgresql';
import { PlaceBaseCommandHandler } from '../../../libs/places/place-base-command-handler.js';
import { Inject } from '@nestjs/common';
import {
  I_PLACE_LIKED_REPOSITORY,
  IPlaceLikedRepository,
} from '../../ports/repositories/place-liked-repository.js';

export class RemoveLikePlaceCommand extends BaseCommand<{ id: string }> {
  validate(props) {
    return z
      .object({
        id: z.string(),
      })
      .parse(props);
  }
}

@CommandHandler(RemoveLikePlaceCommand)
export class RemoveLikePlaceCommandHandler extends PlaceBaseCommandHandler {
  constructor(
    em: EntityManager,
    @Inject(I_PLACE_LIKED_REPOSITORY)
    private readonly repository: IPlaceLikedRepository,
  ) {
    super(em);
  }

  async execute(command: RemoveLikePlaceCommand) {
    const { id } = command.props();
    const auth = command.auth();

    const place = await this.getPlaceOrThrow(id);

    const likeQuery = await this.repository.byUserAndPlace(auth.id(), place.id);
    if (!likeQuery.isPresent()) {
      return;
    }

    await this.repository.delete(likeQuery.getOrThrow());
  }
}
