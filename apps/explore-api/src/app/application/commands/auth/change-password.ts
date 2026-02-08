import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import { z } from 'zod';

import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../ports/repositories/user-repository.js';
import { Optional } from '../../../libs/shared/optional.js';
import {
  I_PASSWORD_STRATEGY,
  IPasswordStrategy,
} from '../../services/auth/password-strategy/password-strategy.interface.js';
import {
  BaseCommand,
  BaseCommandHandler,
} from '../../../libs/shared/command.js';
import { NotFoundException } from '../../../libs/exceptions/not-found-exception.js';

type Props = {
  newPassword: string;
};

export class ChangePasswordCommand extends BaseCommand<Props> {
  validate(props: Props) {
    return z
      .object({
        newPassword: z
          .string()
          .min(8)
          .max(50)
          .regex(
            /(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/,
            'Au moins 1 minuscule, 1 majuscule, 1 chiffre',
          ),
      })
      .parse(props);
  }
}

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordCommandHandler extends BaseCommandHandler<
  ChangePasswordCommand,
  void
> {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_PASSWORD_STRATEGY)
    private readonly passwordStrategy: IPasswordStrategy,
  ) {
    super();
  }

  async execute(command: ChangePasswordCommand): Promise<void> {
    const props = command.props();

    const user = await this.userRepository
      .byId(command.getUserId())
      .then(Optional.getOrThrow(() => new NotFoundException('User not found')));

    await user.changePassword(props.newPassword, this.passwordStrategy);

    await this.userRepository.save(user);
  }
}
