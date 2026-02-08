import z from 'zod';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';

import { BaseCommand } from '../../../libs/shared/command.js';
import { NotFoundException } from '../../../libs/exceptions/not-found-exception.js';
import {
  I_PLACE_REPOSITORY,
  IPlaceRepository,
} from '../../ports/repositories/place-repository.js';
import { NotAuthorizedException } from '../../../libs/exceptions/not-authorized-exception.js';

type Payload = {
  id: string;
};

export class DeletePlaceCommand extends BaseCommand<Payload> {
  validate(props: Payload) {
    return z
      .object({
        id: z.string(),
      })
      .parse(props);
  }
}

@CommandHandler(DeletePlaceCommand)
export class DeletePlaceCommandHandler
  implements ICommandHandler<DeletePlaceCommand>
{
  constructor(
    @Inject(I_PLACE_REPOSITORY)
    private readonly placeRepository: IPlaceRepository,
  ) {}

  async execute(command: DeletePlaceCommand) {
    const props = command.props();

    const placeQuery = await this.placeRepository.byId(props.id);
    if (!placeQuery.isPresent()) {
      throw new NotFoundException('Place not found');
    }

    const place = placeQuery.getOrThrow();

    if (!command.auth().IsOwnerOrAdmin(place.author.id)) {
      throw new NotAuthorizedException();
    }

    await this.placeRepository.delete(place);
  }
}
