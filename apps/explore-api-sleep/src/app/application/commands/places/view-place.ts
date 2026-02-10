import z from 'zod';
import { CommandHandler } from '@nestjs/cqrs';
import { EntityManager } from '@mikro-orm/postgresql';
import { BaseCommand } from '../../../libs/shared/command.js';
import { RandomIdProvider } from '../../../../adapters/for-production/services/random-id-provider.js';
import { PlaceBaseCommandHandler } from '../../../libs/places/place-base-command-handler.js';
import { Inject } from '@nestjs/common';
import {
  I_PLACE_VIEWED_REPOSITORY,
  IPlaceViewedRepository,
} from '../../ports/repositories/place-viewed-repository.js';
import { PlaceViewed } from '../../../domain/entities/place-viewed.js';
import { ref } from '@mikro-orm/core';
import { User } from '../../../domain/entities/user.js';
import { Place } from '../../../domain/entities/place.js';

export class ViewPlaceCommand extends BaseCommand<{ id: string }> {
  validate(props) {
    return z
      .object({
        id: z.string(),
      })
      .parse(props);
  }
}

@CommandHandler(ViewPlaceCommand)
export class ViewPlaceCommandHandler extends PlaceBaseCommandHandler {
  constructor(
    em: EntityManager,
    @Inject(I_PLACE_VIEWED_REPOSITORY)
    private readonly repository: IPlaceViewedRepository,
  ) {
    super(em);
  }

  async execute(command: ViewPlaceCommand) {
    const { id } = command.props();
    const auth = command.auth();

    const place = await this.getPlaceOrThrow(id);

    const viewedQuery = await this.repository.byUserAndPlace(
      auth.id(),
      place.id,
    );

    if (viewedQuery.isPresent()) {
      return;
    }

    const viewed = new PlaceViewed();
    viewed.id = RandomIdProvider.getId();
    viewed.user = ref(User, auth.id());
    viewed.place = ref(Place, place.id);

    await this.repository.save(viewed);
  }
}
