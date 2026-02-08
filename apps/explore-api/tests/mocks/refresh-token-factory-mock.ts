import { IRefreshTokenManager } from '../../src/app/application/services/auth/refresh-token-manager/refresh-token-manager.interface.js';
import { User } from '../../src/app/domain/entities/user.js';
import { RefreshToken } from '../../src/app/domain/entities/refresh-token.js';

export class RefreshTokenManagerMock implements IRefreshTokenManager {
  constructor(
    private readonly expectedUser: User,
    private readonly refreshToken: RefreshToken,
  ) {}

  async create(user: User): Promise<RefreshToken> {
    return this.refreshToken;
  }
}
