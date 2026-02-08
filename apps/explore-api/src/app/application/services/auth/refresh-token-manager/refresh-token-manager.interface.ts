import { User } from '../../../../domain/entities/user.js';
import { RefreshToken } from '../../../../domain/entities/refresh-token.js';

export const I_REFRESH_TOKEN_MANAGER = Symbol('I_REFRESH_TOKEN_MANAGER');

export interface IRefreshTokenManager {
  create(user: User): Promise<RefreshToken>;
}
