import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import { z } from 'zod';

import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../ports/repositories/user-repository.js';
import { Optional } from '../../../libs/shared/optional.js';
import {
  I_MEMBER_CODE_REPOSITORY,
  IMemberCodeRepository,
} from '../../ports/repositories/member-code-repository.js';
import {
  BaseCommand,
  BaseCommandHandler,
} from '../../../libs/shared/command.js';
import { NotFoundException } from '../../../libs/exceptions/not-found-exception.js';

type Props = {
  code: string;
};

export class ActivateAccountCommand extends BaseCommand<Props> {
  validate(props: Props) {
    return z
      .object({
        code: z.string().max(50),
      })
      .parse(props);
  }
}

@CommandHandler(ActivateAccountCommand)
export class ActivateAccountCommandHandler extends BaseCommandHandler<
  ActivateAccountCommand,
  void
> {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_MEMBER_CODE_REPOSITORY)
    private readonly memberCodeRepository: IMemberCodeRepository,
  ) {
    super();
  }

  async execute(command: ActivateAccountCommand): Promise<void> {
    const props = command.props();

    const user = await this.userRepository
      .byId(command.getUserId())
      .then(Optional.getOrThrow(() => new NotFoundException('User not found')));

    const code = await this.memberCodeRepository
      .byCode(props.code)
      .then(Optional.getOrThrow(() => new NotFoundException('Code not found')));

    user.activate(code);

    await this.userRepository.save(user);
    await this.memberCodeRepository.save(code);
  }
}
