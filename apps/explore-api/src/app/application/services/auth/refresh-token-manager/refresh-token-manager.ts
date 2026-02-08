import {
  I_REFRESH_TOKEN_REPOSITORY,
  IRefreshTokenRepository,
} from '../../../ports/repositories/refresh-token-repository.js';
import { IRefreshTokenManager } from './refresh-token-manager.interface.js';
import { Inject, Injectable } from '@nestjs/common';
import {
  I_AUTH_CONFIG,
  IAuthConfig,
} from '../auth-config/auth-config.interface.js';
import {
  I_ID_PROVIDER,
  IIdProvider,
} from '../../../ports/services/id-provider.interface.js';
import {
  I_DATE_PROVIDER,
  IDateProvider,
} from '../../../ports/services/date-provider.interface.js';
import {
  I_RANDOM_STRING_GENERATOR,
  IRandomStringGenerator,
} from '../../../ports/services/random-string-generator.interface.js';
import { User } from '../../../../domain/entities/user.js';
import { RefreshToken } from '../../../../domain/entities/refresh-token.js';
import { ref } from '@mikro-orm/core';

@Injectable()
export class RefreshTokenManager implements IRefreshTokenManager {
  constructor(
    @Inject(I_ID_PROVIDER) private readonly idProvider: IIdProvider,
    @Inject(I_DATE_PROVIDER) private readonly dateProvider: IDateProvider,
    @Inject(I_RANDOM_STRING_GENERATOR)
    private readonly randomStringGenerator: IRandomStringGenerator,
    @Inject(I_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    @Inject(I_AUTH_CONFIG)
    private readonly authConfig: IAuthConfig,
  ) {}

  async create(user: User): Promise<RefreshToken> {
    const refreshToken = new RefreshToken();
    refreshToken.id = this.idProvider.getId();
    refreshToken.user = ref(User, user.id);
    refreshToken.value = await this.randomStringGenerator.generate();
    refreshToken.createdAt = this.dateProvider.now();
    refreshToken.expiresAt = this.authConfig
      .getRefreshTokenLifetime()
      .addToDate(this.dateProvider.now());
    refreshToken.disabled = false;

    await this.refreshTokenRepository.save(refreshToken);
    return refreshToken;
  }
}
