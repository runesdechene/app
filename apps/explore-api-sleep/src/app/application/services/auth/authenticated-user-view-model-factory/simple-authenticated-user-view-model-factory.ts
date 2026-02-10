import { IAuthenticatedUserViewModelFactory } from './authenticated-user-view-model-factory.interface.js';
import { AccessToken } from '../../../../domain/model/access-token.js';
import { ApiAuthenticatedUser } from '../../../viewmodels/api-authenticated-user.js';
import { Injectable } from '@nestjs/common';
import { User } from '../../../../domain/entities/user.js';
import { RefreshToken } from '../../../../domain/entities/refresh-token.js';

@Injectable()
export class SimpleAuthenticatedUserViewModelFactory
  implements IAuthenticatedUserViewModelFactory
{
  async create(
    user: User,
    refreshToken: RefreshToken,
    accessToken: AccessToken,
  ): Promise<ApiAuthenticatedUser> {
    return {
      user: {
        id: user.id,
        emailAddress: user.emailAddress,
        role: user.role,
        rank: user.rank,
        lastName: user.lastName,
        profileImage: null,
      },
      refreshToken: refreshToken.asToken().snapshot(),
      accessToken: accessToken.snapshot(),
    };
  }
}
