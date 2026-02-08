import { AccessToken } from '../../../../domain/model/access-token.js';
import { ApiAuthenticatedUser } from '../../../viewmodels/api-authenticated-user.js';
import { User } from '../../../../domain/entities/user.js';
import { RefreshToken } from '../../../../domain/entities/refresh-token.js';

export const I_AUTHENTICATED_USER_VIEW_MODEL_FACTORY = Symbol(
  'I_AUTHENTICATED_USER_VIEW_MODEL_FACTORY',
);

export interface IAuthenticatedUserViewModelFactory {
  create(
    user: User,
    refreshToken: RefreshToken,
    accessToken: AccessToken,
  ): Promise<ApiAuthenticatedUser>;
}
