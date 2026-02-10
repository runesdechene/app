import { BaseCommand } from '../../../libs/shared/command.js';
import z from 'zod';
import { CommandHandler } from '@nestjs/cqrs';
import { RandomIdProvider } from '../../../../adapters/for-production/services/random-id-provider.js';
import { EntityManager } from '@mikro-orm/postgresql';
import { PlaceBaseCommandHandler } from '../../../libs/places/place-base-command-handler.js';
import { Inject } from '@nestjs/common';
import {
  I_PLACE_EXPLORED_REPOSITORY,
  IPlaceExploredRepository,
} from '../../ports/repositories/place-explored-repository.js';
import { ref } from '@mikro-orm/core';
import { User } from '../../../domain/entities/user.js';
import { Place } from '../../../domain/entities/place.js';
import { PlaceExplored } from '../../../domain/entities/place-explored.js';

export class ExplorePlaceCommand extends BaseCommand<{ id: string }> {
  validate(props) {
    return z
      .object({
        id: z.string(),
      })
      .parse(props);
  }
}

@CommandHandler(ExplorePlaceCommand)
export class ExplorePlaceCommandHandler extends PlaceBaseCommandHandler {
  constructor(
    em: EntityManager,
    @Inject(I_PLACE_EXPLORED_REPOSITORY)
    private readonly repository: IPlaceExploredRepository,
  ) {
    super(em);
  }

  async execute(command: ExplorePlaceCommand) {
    const { id } = command.props();
    const auth = command.auth();

    const place = await this.getPlaceOrThrow(id);

    const exploreQuery = await this.repository.byUserAndPlace(
      auth.id(),
      place.id,
    );

    if (exploreQuery.isPresent()) {
      return;
    }

    const explored = new PlaceExplored();
    explored.id = RandomIdProvider.getId();
    explored.user = ref(User, auth.id());
    explored.place = ref(Place, place.id);

    await this.repository.save(explored);
  }
}
