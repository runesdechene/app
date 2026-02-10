import { CommandHandler } from '@nestjs/cqrs';
import { Inject, UnauthorizedException } from '@nestjs/common';
import z from 'zod';
import {
  BaseCommand,
  BaseCommandHandler,
} from '../../../libs/shared/command.js';
import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../ports/repositories/user-repository.js';
import { Optional } from '../../../libs/shared/optional.js';
import {
  I_PASSWORD_STRATEGY,
  IPasswordStrategy,
} from '../../services/auth/password-strategy/password-strategy.interface.js';
import { RoleUtils } from '../../../domain/model/role.js';
import { AuthContext } from '../../../domain/model/auth-context.js';
import { DateUtils } from '../../../libs/shared/date-utils.js';
import { User } from '../../../domain/entities/user.js';

type Props = {
  userId: string;
  emailAddress?: string;
  password?: string;
  lastName?: string;
  role?: string;
  rank?: string;
  instagramId?: string;
  websiteUrl?: string;
};

export class UpdateUserCommand extends BaseCommand<Props> {
  validate(props: Props): any {
    return z
      .object({
        userId: z.string(),
        emailAddress: z.string().email().optional(),
        password: z.string().min(6).optional(),
        lastName: z.string().min(2).optional(),
        role: z.string().optional(),
        rank: z.string().optional(),
        instagramId: z.string().max(255).optional(),
        websiteUrl: z.string().max(1024).optional(),
      })
      .parse(props);
  }
}

@CommandHandler(UpdateUserCommand)
export class UpdateUserCommandHandler extends BaseCommandHandler<
  UpdateUserCommand,
  void
> {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_PASSWORD_STRATEGY)
    private readonly passwordStrategy: IPasswordStrategy,
  ) {
    super();
  }

  async execute(command: UpdateUserCommand): Promise<void> {
    const props = command.props();
    const user = await this.userRepository
      .byId(props.userId)
      .then(Optional.getOrThrow());

    this.checkRole(command.auth(), user);

    if (props.password) {
      await user.changePassword(props.password, this.passwordStrategy);
    }

    user.update({
      ...(props.emailAddress ? { emailAddress: props.emailAddress } : {}),
      ...(props.lastName ? { lastName: props.lastName } : {}),
      ...(props.role ? { role: props.role } : {}),
      ...(props.rank ? { rank: props.rank } : {}),
      ...(props.instagramId ? { instagramId: props.instagramId } : {}),
      ...(props.websiteUrl ? { websiteUrl: props.websiteUrl } : {}),
    });

    await this.userRepository.save(user);
  }

  private checkRole(context: AuthContext, user: User) {
    if (RoleUtils.toValue(context.role()) < RoleUtils.toValue(user.role)) {
      throw new UnauthorizedException(
        'You cannot update a user with a role higher than yours',
      );
    }
  }
}
