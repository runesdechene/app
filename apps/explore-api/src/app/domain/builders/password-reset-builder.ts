import { RandomIdProvider } from '../../../adapters/for-production/services/random-id-provider.js';
import { PasswordReset } from '../entities/password-reset.js';
import { User } from '../entities/user.js';
import { ref } from '@mikro-orm/core';

export class PasswordResetBuilder {
  private readonly _props: Partial<PasswordReset>;

  constructor(props?: Partial<PasswordReset>) {
    this._props = {
      id: RandomIdProvider.getId(),
      user: ref(User, 'user-1'),
      code: 'azerty',
      expiresAt: new Date('2024-06-01T00:00:00.000Z'),
      isConsumed: false,
      ...props,
    };
  }

  id(id: string) {
    this._props.id = id;
    return this;
  }

  userId(userId: string) {
    this._props.user = ref(User, userId);
    return this;
  }

  code(code: string) {
    this._props.code = code;
    return this;
  }

  expiresAt(expiresAt: Date) {
    this._props.expiresAt = expiresAt;
    return this;
  }

  consumed(isConsumed: boolean) {
    this._props.isConsumed = isConsumed;
    return this;
  }

  build() {
    const passwordReset = new PasswordReset();
    Object.assign(passwordReset, this._props);

    return passwordReset;
  }
}
