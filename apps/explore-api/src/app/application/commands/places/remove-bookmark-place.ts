import { BaseCommand } from '../../../libs/shared/command.js';
import z from 'zod';
import { CommandHandler } from '@nestjs/cqrs';
import { EntityManager } from '@mikro-orm/postgresql';
import { PlaceBaseCommandHandler } from '../../../libs/places/place-base-command-handler.js';
import { Inject } from '@nestjs/common';
import {
  I_PLACE_BOOKMARKED_REPOSITORY,
  IPlaceBookmarkedRepository,
} from '../../ports/repositories/place-bookmarked-repository.js';

export class RemoveBookmarkPlaceCommand extends BaseCommand<{ id: string }> {
  validate(props) {
    return z
      .object({
        id: z.string(),
      })
      .parse(props);
  }
}

@CommandHandler(RemoveBookmarkPlaceCommand)
export class RemoveBookmarkPlaceCommandHandler extends PlaceBaseCommandHandler {
  constructor(
    em: EntityManager,
    @Inject(I_PLACE_BOOKMARKED_REPOSITORY)
    private readonly repository: IPlaceBookmarkedRepository,
  ) {
    super(em);
  }

  async execute(command: RemoveBookmarkPlaceCommand) {
    const { id } = command.props();
    const auth = command.auth();

    const place = await this.getPlaceOrThrow(id);

    const bookmarkedQuery = await this.repository.byUserAndPlace(
      auth.id(),
      place.id,
    );
    if (!bookmarkedQuery.isPresent()) {
      return;
    }

    await this.repository.delete(bookmarkedQuery.getOrThrow());
  }
}
