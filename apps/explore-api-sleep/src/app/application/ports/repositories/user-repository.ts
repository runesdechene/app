import { Optional } from '../../../libs/shared/optional.js';
import { User } from '../../../domain/entities/user.js';

export const I_USER_REPOSITORY = Symbol('I_USER_REPOSITORY');

export interface IUserRepository {
  findAdmins(): Promise<User[]>;

  byId(id: string): Promise<Optional<User>>;

  byEmailAddress(emailAddress: string): Promise<Optional<User>>;

  save(user: User): Promise<void>;

  delete(user: User): Promise<void>;

  clear(): Promise<void>;
}
