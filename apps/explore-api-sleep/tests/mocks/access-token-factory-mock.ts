import { IAccessTokenFactory } from '../../src/app/application/services/auth/access-token-factory/access-token-factory.interface.js';
import { AccessToken } from '../../src/app/domain/model/access-token.js';
import { User } from '../../src/app/domain/entities/user.js';

export class AccessTokenFactoryMock implements IAccessTokenFactory {
  constructor(
    private readonly expectedUser: User,
    private readonly accessToken: AccessToken,
  ) {}

  async create(user: User): Promise<AccessToken> {
    return this.accessToken;
  }
}
