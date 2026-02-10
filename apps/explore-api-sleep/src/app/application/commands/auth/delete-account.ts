import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';

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

export class DeleteAccountCommand extends BaseCommand<{}> {}

@CommandHandler(DeleteAccountCommand)
export class DeleteAccountCommandHandler extends BaseCommandHandler<
  DeleteAccountCommand,
  void
> {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {
    super();
  }

  async execute(command: DeleteAccountCommand): Promise<void> {
    const props = command.props();

    const user = await this.userRepository
      .byId(command.getUserId())
      .then(Optional.getOrThrow(() => new NotFoundException('User not found')));

    await this.userRepository.delete(user);
  }
}
