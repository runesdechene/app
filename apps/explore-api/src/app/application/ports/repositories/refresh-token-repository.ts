import { Optional } from '../../../libs/shared/optional.js';
import { RefreshToken } from '../../../domain/entities/refresh-token.js';

export const I_REFRESH_TOKEN_REPOSITORY = Symbol('I_REFRESH_TOKEN_REPOSITORY');

export interface IRefreshTokenRepository {
  byId(id: string): Promise<Optional<RefreshToken>>;

  byValue(value: string): Promise<Optional<RefreshToken>>;

  save(user: RefreshToken): Promise<void>;

  delete(user: RefreshToken): Promise<void>;

  clear(): Promise<void>;
}
