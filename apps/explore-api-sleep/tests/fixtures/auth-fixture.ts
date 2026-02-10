import { ITester } from '../config/tester.interface.js';
import {
  I_REFRESH_TOKEN_MANAGER,
  IRefreshTokenManager,
} from '../../src/app/application/services/auth/refresh-token-manager/refresh-token-manager.interface.js';
import { UserFixture } from './user-fixture.js';
import {
  I_ACCESS_TOKEN_FACTORY,
  IAccessTokenFactory,
} from '../../src/app/application/services/auth/access-token-factory/access-token-factory.interface.js';
import { AccessToken } from '../../src/app/domain/model/access-token.js';
import { RefreshToken } from '../../src/app/domain/entities/refresh-token.js';

export class AuthFixture extends UserFixture {
  private _refreshToken: RefreshToken;
  private _accessToken: AccessToken;

  async load(tester: ITester): Promise<void> {
    await super.load(tester);

    const refreshTokenManager = tester.get<IRefreshTokenManager>(
      I_REFRESH_TOKEN_MANAGER,
    );

    this._refreshToken = await refreshTokenManager.create(this.entity);

    const accessTokenFactory = tester.get<IAccessTokenFactory>(
      I_ACCESS_TOKEN_FACTORY,
    );

    this._accessToken = await accessTokenFactory.create(this.entity);
  }

  refreshTokenValue() {
    return this._refreshToken.value;
  }

  authorize() {
    return `Bearer ${this._accessToken.value()}`;
  }
}
