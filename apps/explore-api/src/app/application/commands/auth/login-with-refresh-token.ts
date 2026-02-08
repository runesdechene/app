import { Inject } from '@nestjs/common';
import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../ports/repositories/user-repository.js';
import {
  I_ACCESS_TOKEN_FACTORY,
  IAccessTokenFactory,
} from '../../services/auth/access-token-factory/access-token-factory.interface.js';
import { ApiAuthenticatedUser } from '../../viewmodels/api-authenticated-user.js';
import {
  I_REFRESH_TOKEN_REPOSITORY,
  IRefreshTokenRepository,
} from '../../ports/repositories/refresh-token-repository.js';
import { CommandHandler } from '@nestjs/cqrs';
import { Optional } from '../../../libs/shared/optional.js';
import {
  BaseCommand,
  BaseCommandHandler,
  HeadersDevice,
} from '../../../libs/shared/command.js';
import {
  I_DATE_PROVIDER,
  IDateProvider,
} from '../../ports/services/date-provider.interface.js';
import { BadRequestException } from '../../../libs/exceptions/bad-request-exception.js';
import { NotFoundException } from '../../../libs/exceptions/not-found-exception.js';
import z from 'zod';
import {
  I_AUTHENTICATED_USER_VIEW_MODEL_FACTORY,
  IAuthenticatedUserViewModelFactory,
} from '../../services/auth/authenticated-user-view-model-factory/authenticated-user-view-model-factory.interface.js';
import { User } from '../../../domain/entities/user.js';
import { RefreshToken } from '../../../domain/entities/refresh-token.js';

type Props = {
  value: string;
};

export class LoginWithRefreshTokenCommand extends BaseCommand<Props> {
  validate(props: Props) {
    return z
      .object({
        value: z.string().max(255),
      })
      .parse(props);
  }
}

@CommandHandler(LoginWithRefreshTokenCommand)
export class LoginWithRefreshTokenCommandHandler extends BaseCommandHandler<
  LoginWithRefreshTokenCommand,
  ApiAuthenticatedUser
> {
  constructor(
    @Inject(I_DATE_PROVIDER) private readonly dateProvider: IDateProvider,
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    @Inject(I_ACCESS_TOKEN_FACTORY)
    private readonly accessTokenFactory: IAccessTokenFactory,
    @Inject(I_AUTHENTICATED_USER_VIEW_MODEL_FACTORY)
    private readonly authenticatedUserViewModelFactory: IAuthenticatedUserViewModelFactory,
  ) {
    super();
  }

  async execute(
    command: LoginWithRefreshTokenCommand,
  ): Promise<ApiAuthenticatedUser> {
    const props = command.props();
    const headers = command.headers();

    const refreshToken = await this.fetchRefreshToken(props);
    this.checkValidity(refreshToken);

    const user = await this.fetchUser(refreshToken);
    await this.updateLastAccess(user);
    await this.updateLastDevice(user, headers);
    return await this.createViewModel(user, refreshToken);
  }

  private async createViewModel(user: User, refreshToken: RefreshToken) {
    const accessToken = await this.accessTokenFactory.create(user);
    return this.authenticatedUserViewModelFactory.create(
      user,
      refreshToken,
      accessToken,
    );
  }

  private async fetchUser(refreshToken: RefreshToken) {
    return await this.userRepository
      .byId(refreshToken.user.id)
      .then(Optional.getOrThrow(() => new NotFoundException('User not found')));
  }

  private checkValidity(refreshToken: RefreshToken) {
    if (refreshToken.hasExpired(this.dateProvider)) {
      throw BadRequestException.create(
        'INVALID_REFRESH_TOKEN',
        'Refresh token has expired',
      );
    }

    if (refreshToken.disabled) {
      throw BadRequestException.create(
        'INVALID_REFRESH_TOKEN',
        'Refresh token is invalid',
      );
    }
  }

  private async updateLastAccess(user: User) {
    user.update({
      lastAccess: new Date(),
    });

    return await this.userRepository.save(user);
  }

  private async updateLastDevice(user: User, headers?: HeadersDevice) {
    const lastOs = headers?.device_os;
    const lastVersion = headers?.device_version;
    if (
      (!!lastOs && lastOs !== user.lastDeviceOs) ||
      (!!lastVersion && lastVersion !== user.lastDeviceVersion)
    ) {
      user.update({
        lastDeviceOs: lastOs,
        lastDeviceVersion: lastVersion,
      });
      await this.userRepository.save(user);
    }
  }

  private async fetchRefreshToken(props: Props) {
    return this.refreshTokenRepository
      .byValue(props.value)
      .then(
        Optional.getOrThrow(
          () => new NotFoundException('Refresh token not found'),
        ),
      );
  }
}
