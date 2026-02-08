import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import { z } from 'zod';

import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../ports/repositories/user-repository.js';
import { Optional } from '../../../libs/shared/optional.js';
import {
  BaseCommand,
  BaseCommandHandler,
} from '../../../libs/shared/command.js';
import { NotFoundException } from '../../../libs/exceptions/not-found-exception.js';
import {
  I_IMAGE_MEDIA_REPOSITORY,
  IImageMediaRepository,
} from '../../ports/repositories/image-media-repository.js';
import { Nullable } from '../../../libs/shared/types.js';
import { DateUtils } from '../../../libs/shared/date-utils.js';

type Props = {
  lastName?: string;
  gender?: string;
  biography?: string;
  profileImageId?: Nullable<string>;
  instagramId?: string;
  websiteUrl?: string;
};

export class ChangeInformationsCommand extends BaseCommand<Props> {
  validate(props: Props) {
    return z
      .object({
        lastName: z.string().optional(),
        gender: z.enum(['male', 'female', 'unknown']).optional(),
        biography: z.string().max(500).optional(),
        profileImageId: z.string().optional().nullable(),
        instagramId: z.string().max(255).optional(),
        websiteUrl: z.string().max(1024).optional(),
      })
      .parse(props);
  }
}

@CommandHandler(ChangeInformationsCommand)
export class ChangeInformationsCommandHandler extends BaseCommandHandler<
  ChangeInformationsCommand,
  void
> {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_IMAGE_MEDIA_REPOSITORY)
    private readonly imageMediaRepository: IImageMediaRepository,
  ) {
    super();
  }

  async execute(command: ChangeInformationsCommand): Promise<void> {
    const props = command.props();

    const user = await this.userRepository
      .byId(command.getUserId())
      .then(Optional.getOrThrow(() => new NotFoundException('User not found')));

    if (props.profileImageId) {
      const mediaOption = await this.imageMediaRepository.byId(
        props.profileImageId,
      );

      if (!mediaOption.isPresent()) {
        throw new NotFoundException('Profile Image not found');
      }
    }

    user.update({
      ...(props.lastName ? { lastName: props.lastName } : {}),
      ...(props.gender ? { gender: props.gender as any } : {}),
      ...(typeof props.profileImageId === 'string' ||
      props.profileImageId === null
        ? { profileImageId: props.profileImageId }
        : {}),
      ...(props.biography ? { biography: props.biography } : {}),
      ...(props.instagramId ? { instagramId: props.instagramId } : {}),
      ...(props.websiteUrl ? { websiteUrl: props.websiteUrl } : {}),
    });

    await this.userRepository.save(user);
  }
}
