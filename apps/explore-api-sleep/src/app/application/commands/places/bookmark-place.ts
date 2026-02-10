import { BaseCommand } from '../../../libs/shared/command.js';
import z from 'zod';
import { CommandHandler } from '@nestjs/cqrs';
import { RandomIdProvider } from '../../../../adapters/for-production/services/random-id-provider.js';
import { EntityManager } from '@mikro-orm/postgresql';
import { PlaceBaseCommandHandler } from '../../../libs/places/place-base-command-handler.js';
import { Inject } from '@nestjs/common';
import {
  I_PLACE_BOOKMARKED_REPOSITORY,
  IPlaceBookmarkedRepository,
} from '../../ports/repositories/place-bookmarked-repository.js';
import { ref } from '@mikro-orm/core';
import { User } from '../../../domain/entities/user.js';
import { Place } from '../../../domain/entities/place.js';
import { PlaceBookmarked } from '../../../domain/entities/place-bookmarked.js';

export class BookmarkPlaceCommand extends BaseCommand<{ id: string }> {
  validate(props) {
    return z
      .object({
        id: z.string(),
      })
      .parse(props);
  }
}

@CommandHandler(BookmarkPlaceCommand)
export class BookmarkPlaceCommandHandler extends PlaceBaseCommandHandler {
  constructor(
    em: EntityManager,
    @Inject(I_PLACE_BOOKMARKED_REPOSITORY)
    private readonly repository: IPlaceBookmarkedRepository,
  ) {
    super(em);
  }

  async execute(command: BookmarkPlaceCommand) {
    const { id } = command.props();
    const auth = command.auth();

    const place = await this.getPlaceOrThrow(id);

    const bookmarkQuery = await this.repository.byUserAndPlace(
      auth.id(),
      place.id,
    );
    if (bookmarkQuery.isPresent()) {
      return;
    }

    const bookmark = new PlaceBookmarked();
    bookmark.id = RandomIdProvider.getId();
    bookmark.user = ref(User, auth.id());
    bookmark.place = ref(Place, place.id);

    await this.repository.save(bookmark);
  }
}
