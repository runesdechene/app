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

type Props = {
  emailAddress: string;
};

export class ChangeEmailAddressCommand extends BaseCommand<Props> {
  validate(props: Props) {
    return z
      .object({
        emailAddress: z.string().email(),
      })
      .parse(props);
  }
}

@CommandHandler(ChangeEmailAddressCommand)
export class ChangeEmailAddressCommandHandler extends BaseCommandHandler<
  ChangeEmailAddressCommand,
  void
> {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {
    super();
  }

  async execute(command: ChangeEmailAddressCommand): Promise<void> {
    const props = command.props();

    const user = await this.userRepository
      .byId(command.getUserId())
      .then(Optional.getOrThrow(() => new NotFoundException('User not found')));

    user.changeEmailAddress(props.emailAddress);

    await this.userRepository.save(user);
  }
}
