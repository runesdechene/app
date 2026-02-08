import { CommandHandler } from '@nestjs/cqrs';
import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../ports/repositories/user-repository.js';
import {
  I_PASSWORD_STRATEGY,
  IPasswordStrategy,
} from '../../services/auth/password-strategy/password-strategy.interface.js';
import { Inject } from '@nestjs/common';
import { ApiAuthenticatedUser } from '../../viewmodels/api-authenticated-user.js';
import { Optional } from '../../../libs/shared/optional.js';
import {
  I_REFRESH_TOKEN_MANAGER,
  IRefreshTokenManager,
} from '../../services/auth/refresh-token-manager/refresh-token-manager.interface.js';
import {
  I_ACCESS_TOKEN_FACTORY,
  IAccessTokenFactory,
} from '../../services/auth/access-token-factory/access-token-factory.interface.js';
import {
  BaseCommand,
  BaseCommandHandler,
  HeadersDevice,
} from '../../../libs/shared/command.js';
import { BadRequestException } from '../../../libs/exceptions/bad-request-exception.js';
import { NotFoundException } from '../../../libs/exceptions/not-found-exception.js';
import z from 'zod';
import {
  I_AUTHENTICATED_USER_VIEW_MODEL_FACTORY,
  IAuthenticatedUserViewModelFactory,
} from '../../services/auth/authenticated-user-view-model-factory/authenticated-user-view-model-factory.interface.js';
import { User } from '../../../domain/entities/user.js';

type Props = {
  emailAddress: string;
  password: string;
};

export class LoginWithCredentialsCommand extends BaseCommand<Props> {
  validate(props: Props) {
    return z
      .object({
        emailAddress: z.string().email(),
        password: z.string().max(255),
      })
      .parse(props);
  }
}

@CommandHandler(LoginWithCredentialsCommand)
export class LoginWithCredentialsCommandHandler extends BaseCommandHandler<
  LoginWithCredentialsCommand,
  ApiAuthenticatedUser
> {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_PASSWORD_STRATEGY)
    private readonly passwordStrategy: IPasswordStrategy,
    @Inject(I_REFRESH_TOKEN_MANAGER)
    private readonly refreshTokenManager: IRefreshTokenManager,
    @Inject(I_ACCESS_TOKEN_FACTORY)
    private readonly accessTokenFactory: IAccessTokenFactory,
    @Inject(I_AUTHENTICATED_USER_VIEW_MODEL_FACTORY)
    private readonly authenticatedUserViewModelFactory: IAuthenticatedUserViewModelFactory,
  ) {
    super();
  }

  async execute(
    command: LoginWithCredentialsCommand,
  ): Promise<ApiAuthenticatedUser> {
    const props = command.props();
    const headers = command.headers();
    const user = await this.fetchUser(command);
    await this.checkPassword(user, props.password);
    await this.updateLastAccess(user);
    await this.updateLastDevice(user, headers);

    return await this.createViewModel(user);
  }

  private async createViewModel(user: User) {
    const refreshToken = await this.refreshTokenManager.create(user);
    const accessToken = await this.accessTokenFactory.create(user);

    return this.authenticatedUserViewModelFactory.create(
      user,
      refreshToken,
      accessToken,
    );
  }

  private async checkPassword(user: User, password: string) {
    const isPasswordValid = await user.isPasswordValid(
      this.passwordStrategy,
      password,
    );

    if (!isPasswordValid) {
      throw BadRequestException.create(
        'INVALID_CREDENTIALS',
        'Invalid credentials',
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

  private async fetchUser(command: LoginWithCredentialsCommand) {
    return await this.userRepository
      .byEmailAddress(command.props().emailAddress)
      .then(Optional.getOrThrow(() => new NotFoundException('User not found')));
  }
}
