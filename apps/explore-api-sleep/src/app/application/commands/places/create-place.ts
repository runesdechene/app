import z from 'zod';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';

import { BaseCommand } from '../../../libs/shared/command.js';
import { NotFoundException } from '../../../libs/exceptions/not-found-exception.js';
import { RandomIdProvider } from '../../../../adapters/for-production/services/random-id-provider.js';
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
import {
  Accessibility,
  accessibilityKeys,
  Place,
} from '../../../domain/entities/place.js';
import { User } from '../../../domain/entities/user.js';
import { ref } from '@mikro-orm/core';
import { PlaceType } from '../../../domain/entities/place-type.js';
import { Nullable } from '../../../libs/shared/types.js';

type Payload = {
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

export class CreatePlaceCommand extends BaseCommand<Payload> {
  validate(props: Payload) {
    return z
      .object({
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

@CommandHandler(CreatePlaceCommand)
export class CreatePlaceCommandHandler
  implements ICommandHandler<CreatePlaceCommand, { id: string }>
{
  constructor(
    @Inject(I_PLACE_REPOSITORY)
    private readonly placeRepository: IPlaceRepository,
    @Inject(I_PLACE_TYPE_REPOSITORY)
    private readonly placeTypeRepository: IPlaceTypeRepository,
  ) {}

  async execute(command: CreatePlaceCommand) {
    const props = command.props();

    const placeTypeQuery = await this.placeTypeRepository.byId(
      props.placeTypeId,
    );

    if (!placeTypeQuery.isPresent()) {
      throw new NotFoundException('Place type not found');
    }

    const placeType = placeTypeQuery.getOrThrow();

    const place = new Place();
    place.id = RandomIdProvider.getId();
    place.author = ref(User, command.getUserId());
    place.placeType = ref(PlaceType, placeType.id);
    place.title = sanitizeString(props.title);
    place.text = sanitizeLongText(props.text);
    place.address = '';
    place.latitude = props.location.latitude;
    place.longitude = props.location.longitude;
    place.private = props.private;
    place.masked = false;
    place.images = props.images.map((image) => ({
      id: image.id,
      url: image.url,
    }));
    place.accessibility = props.accessibility ?? null;
    place.sensible = props.sensible ?? false;
    place.beginAt = props.beginAt ? props.beginAt : null;
    place.endAt = props.endAt ? props.endAt : null;

    await this.placeRepository.save(place);

    return {
      id: place.id,
    };
  }
}
