import { Optional } from '../../../libs/shared/optional.js';
import { PasswordReset } from '../../../domain/entities/password-reset.js';

export const I_PASSWORD_RESET_REPOSITORY = Symbol(
  'I_PASSWORD_RESET_REPOSITORY',
);

export interface IPasswordResetRepository {
  byId(id: string): Promise<Optional<PasswordReset>>;

  byCode(code: string): Promise<Optional<PasswordReset>>;

  save(user: PasswordReset): Promise<void>;

  delete(user: PasswordReset): Promise<void>;

  clear(): Promise<void>;
}
