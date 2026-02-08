import z from 'zod';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';

import { BaseCommand } from '../../../libs/shared/command.js';
import { NotFoundException } from '../../../libs/exceptions/not-found-exception.js';
import { sanitizeString } from '../../../libs/utils/sanitize-string.js';
import { sanitizeLongText } from '../../../libs/utils/sanitize-long-text.js';
import {
  I_PLACE_REPOSITORY,
  IPlaceRepository,
} from '../../ports/repositories/place-repository.js';
import {
  I_PLACE_TYPE_REPOSITORY,
  IPlaceTypeRepository,
} from '../../ports/repositories/place-type-repository.js';
import { NotAuthorizedException } from '../../../libs/exceptions/not-authorized-exception.js';
import {
  Accessibility,
  accessibilityKeys,
} from '../../../domain/entities/place.js';
import { Nullable } from '../../../libs/shared/types.js';

type Payload = {
  id: string;
  placeTypeId: string;
  title: string;
  text: string;
  location: {
    latitude: number;
    longitude: number;
  };
  private: boolean;
  images: Array<{
    id: string;
    url: string;
  }>;
  accessibility?: Nullable<Accessibility>;
  sensible?: boolean;
  beginAt?: string | null;
  endAt?: string | null;
};

export class UpdatePlaceCommand extends BaseCommand<Payload> {
  validate(props: Payload) {
    return z
      .object({
        id: z.string(),
        placeTypeId: z.string(),
        title: z.string().min(5).max(100),
        text: z.string().min(25).max(2500),
        location: z.object({
          latitude: z.number(),
          longitude: z.number(),
        }),
        private: z.boolean(),
        images: z.array(
          z.object({
            id: z.string(),
            url: z.string(),
          }),
        ),
        accessibility: z.enum(accessibilityKeys).nullable().optional(),
        sensible: z.boolean().optional(),
        beginAt: z.string().nullable().optional(),
        endAt: z.string().nullable().optional(),
      })
      .parse(props);
  }
}

@CommandHandler(UpdatePlaceCommand)
export class UpdatePlaceCommandHandler
  implements ICommandHandler<UpdatePlaceCommand>
{
  constructor(
    @Inject(I_PLACE_REPOSITORY)
    private readonly placeRepository: IPlaceRepository,
    @Inject(I_PLACE_TYPE_REPOSITORY)
    private readonly placeTypeRepository: IPlaceTypeRepository,
  ) {}

  async execute(command: UpdatePlaceCommand) {
    const props = command.props();

    const placeQuery = await this.placeRepository.byId(props.id);
    if (!placeQuery.isPresent()) {
      throw new NotFoundException('Place not found');
    }

    const place = placeQuery.getOrThrow();

    if (!command.auth().IsOwnerOrAdmin(place.author.id)) {
      throw new NotAuthorizedException();
    }

    if (props.placeTypeId) {
      await this.ensurePlaceTypeExists(props.placeTypeId);
    }

    place.update({
      placeTypeId: props.placeTypeId,
      title: sanitizeString(props.title),
      text: sanitizeLongText(props.text),
      latitude: props.location.latitude,
      longitude: props.location.longitude,
      private: props.private,
      images: props.images,
      accessibility: props.accessibility ?? null,
      sensible: props.sensible ?? false,
      beginAt: props.beginAt ? props.beginAt : null,
      endAt: props.endAt ? props.endAt : null,
    });

    await this.placeRepository.save(place);
  }

  private async ensurePlaceTypeExists(placeTypeId: string) {
    const placeTypeQuery = await this.placeTypeRepository.byId(placeTypeId);
    if (!placeTypeQuery.isPresent()) {
      throw new NotFoundException('Place type not found');
    }
  }
}
