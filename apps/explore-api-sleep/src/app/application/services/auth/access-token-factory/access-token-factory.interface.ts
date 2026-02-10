import { AccessToken } from '../../../../domain/model/access-token.js';
import { User } from '../../../../domain/entities/user.js';

export const I_ACCESS_TOKEN_FACTORY = Symbol('I_ACCESS_TOKEN_FACTORY');

export interface IAccessTokenFactory {
  create(user: User): Promise<AccessToken>;
}
