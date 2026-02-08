import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import { z } from 'zod';
import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../ports/repositories/user-repository.js';
import {
  I_PASSWORD_STRATEGY,
  IPasswordStrategy,
} from '../../services/auth/password-strategy/password-strategy.interface.js';
import {
  I_ACCESS_TOKEN_FACTORY,
  IAccessTokenFactory,
} from '../../services/auth/access-token-factory/access-token-factory.interface.js';
import {
  I_REFRESH_TOKEN_MANAGER,
  IRefreshTokenManager,
} from '../../services/auth/refresh-token-manager/refresh-token-manager.interface.js';
import {
  I_MEMBER_CODE_REPOSITORY,
  IMemberCodeRepository,
} from '../../ports/repositories/member-code-repository.js';
import { Nullable } from '../../../libs/shared/types.js';
import { Rank } from '../../../domain/model/rank.js';
import { GenderUtils } from '../../../domain/model/gender.js';
import {
  BaseCommand,
  BaseCommandHandler,
} from '../../../libs/shared/command.js';
import {
  I_ID_PROVIDER,
  IIdProvider,
} from '../../ports/services/id-provider.interface.js';
import { BadRequestException } from '../../../libs/exceptions/bad-request-exception.js';
import {
  I_AUTHENTICATED_USER_VIEW_MODEL_FACTORY,
  IAuthenticatedUserViewModelFactory,
} from '../../services/auth/authenticated-user-view-model-factory/authenticated-user-view-model-factory.interface.js';
import { DateUtils } from '../../../libs/shared/date-utils.js';
import { ApiAuthenticatedUser } from '../../viewmodels/api-authenticated-user.js';
import { User } from '../../../domain/entities/user.js';
import { MemberCode } from '../../../domain/entities/member-code.js';

type Props = {
  emailAddress: string;
  password: string;
  lastName: string;
  gender: string;

  code?: Nullable<string>;
};

export class RegisterCommand extends BaseCommand<Props> {
  validate(props: Props) {
    return z
      .object({
        emailAddress: z.string().email(),
        password: z.string(),
        lastName: z.string(),
        gender: z.string(),
        code: z.string().optional().nullable(),
      })
      .parse(props);
  }
}

@CommandHandler(RegisterCommand)
export class RegisterCommandHandler extends BaseCommandHandler<
  RegisterCommand,
  ApiAuthenticatedUser
> {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_PASSWORD_STRATEGY)
    private readonly passwordStrategy: IPasswordStrategy,
    @Inject(I_ID_PROVIDER)
    private readonly idProvider: IIdProvider,
    @Inject(I_ACCESS_TOKEN_FACTORY)
    private readonly accessTokenFactory: IAccessTokenFactory,
    @Inject(I_REFRESH_TOKEN_MANAGER)
    private readonly refreshTokenManager: IRefreshTokenManager,
    @Inject(I_MEMBER_CODE_REPOSITORY)
    private readonly memberCodeRepository: IMemberCodeRepository,
    @Inject(I_AUTHENTICATED_USER_VIEW_MODEL_FACTORY)
    private readonly authenticatedUserViewModelFactory: IAuthenticatedUserViewModelFactory,
  ) {
    super();
  }

  async execute(command: RegisterCommand): Promise<ApiAuthenticatedUser> {
    const props = command.props();

    const memberCode: Nullable<MemberCode> = await this.handleMemberCode(props);

    const existingUser = await this.userRepository.byEmailAddress(
      props.emailAddress,
    );

    if (existingUser.isPresent()) {
      throw BadRequestException.create(
        'EMAIL_ALREADY_REGISTERED',
        'emailAddress already registered',
      );
    }

    const user = await User.register({
      id: this.idProvider.getId(),
      emailAddress: props.emailAddress,
      password: props.password,
      passwordStrategy: this.passwordStrategy,
      rank: memberCode !== null ? Rank.MEMBER : Rank.GUEST,
      gender: GenderUtils.fromUnknown(props.gender),
      lastName: props.lastName,
    });

    await this.userRepository.save(user);

    if (memberCode !== null) {
      memberCode.consume(user.id);
      await this.memberCodeRepository.save(memberCode);
    }

    const refreshToken = await this.refreshTokenManager.create(user);
    const accessToken = await this.accessTokenFactory.create(user);

    return this.authenticatedUserViewModelFactory.create(
      user,
      refreshToken,
      accessToken,
    );
  }

  private async handleMemberCode(props: Props) {
    if (!props.code) {
      return null;
    }

    const memberCodeQuery = await this.memberCodeRepository.byCode(props.code);
    if (!memberCodeQuery.isPresent()) {
      throw BadRequestException.create(
        'INVALID_MEMBER_CODE',
        'Invalid member code',
      );
    }

    const memberCode = memberCodeQuery.getOrThrow();
    if (!memberCode.isConsumable()) {
      throw BadRequestException.create(
        'INVALID_MEMBER_CODE',
        'Invalid member code',
      );
    }

    return memberCode;
  }
}
