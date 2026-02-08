import { Inject } from '@nestjs/common';
import { IAccessTokenFactory } from './access-token-factory.interface.js';
import {
  AccessToken,
  AccessTokenPayload,
} from '../../../../domain/model/access-token.js';
import {
  I_JWT_SERVICE,
  IJwtService,
} from '../jwt-service/jwt-service.interface.js';

import {
  I_AUTH_CONFIG,
  IAuthConfig,
} from '../auth-config/auth-config.interface.js';
import {
  I_DATE_PROVIDER,
  IDateProvider,
} from '../../../ports/services/date-provider.interface.js';
import { User } from '../../../../domain/entities/user.js';

export class AccessTokenFactory implements IAccessTokenFactory {
  constructor(
    @Inject(I_JWT_SERVICE) private readonly jwtService: IJwtService,
    @Inject(I_DATE_PROVIDER) private readonly dateProvider: IDateProvider,
    @Inject(I_AUTH_CONFIG) private readonly authConfig: IAuthConfig,
  ) {}

  async create(user: User): Promise<AccessToken> {
    const now = this.dateProvider.now();

    return this.jwtService.sign<AccessTokenPayload>(
      {
        aud: 'api',
        sub: user.id,
        emailAddress: user.emailAddress,
        role: user.role,
        rank: user.rank,
        lastName: user.lastName,
      },
      {
        issuedAt: now,
        expiresAt: this.authConfig.getAccessTokenLifetime().addToDate(now),
      },
    );
  }
}
