import { CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../ports/repositories/user-repository.js';
import { Optional } from '../../../libs/shared/optional.js';
import {
  BaseCommand,
  BaseCommandHandler,
} from '../../../libs/shared/command.js';
import z from 'zod';

type Props = {
  userId: string;
};

export class DeleteUserCommand extends BaseCommand<Props> {
  validate(props: Props): Props {
    return z
      .object({
        userId: z.string(),
      })
      .parse(props);
  }
}

@CommandHandler(DeleteUserCommand)
export class DeleteUserCommandHandler extends BaseCommandHandler<
  DeleteUserCommand,
  void
> {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {
    super();
  }

  async execute(command: DeleteUserCommand): Promise<void> {
    const props = command.props();
    const user = await this.userRepository
      .byId(props.userId)
      .then(Optional.getOrThrow());

    await this.userRepository.delete(user);
  }
}
