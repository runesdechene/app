import { BaseCommand } from '../../../libs/shared/command.js';
import z from 'zod';
import { CommandHandler } from '@nestjs/cqrs';
import { EntityManager } from '@mikro-orm/postgresql';
import { PlaceBaseCommandHandler } from '../../../libs/places/place-base-command-handler.js';
import { Inject } from '@nestjs/common';
import {
  I_PLACE_EXPLORED_REPOSITORY,
  IPlaceExploredRepository,
} from '../../ports/repositories/place-explored-repository.js';

export class RemoveExplorePlaceCommand extends BaseCommand<{ id: string }> {
  validate(props) {
    return z
      .object({
        id: z.string(),
      })
      .parse(props);
  }
}

@CommandHandler(RemoveExplorePlaceCommand)
export class RemoveExplorePlaceCommandHandler extends PlaceBaseCommandHandler {
  constructor(
    em: EntityManager,
    @Inject(I_PLACE_EXPLORED_REPOSITORY)
    private readonly repository: IPlaceExploredRepository,
  ) {
    super(em);
  }

  async execute(command: RemoveExplorePlaceCommand) {
    const { id } = command.props();
    const auth = command.auth();

    const place = await this.getPlaceOrThrow(id);

    const exploredQuery = await this.repository.byUserAndPlace(
      auth.id(),
      place.id,
    );
    if (!exploredQuery.isPresent()) {
      return;
    }

    await this.repository.delete(exploredQuery.getOrThrow());
  }
}
