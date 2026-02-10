import { RefreshToken } from '../entities/refresh-token.js';
import { User } from '../entities/user.js';
import { ref } from '@mikro-orm/core';

export class RefreshTokenBuilder {
  private readonly _props: Partial<RefreshToken>;

  constructor(props?: Partial<RefreshToken>) {
    this._props = {
      id: 'refresh-token-1',
      user: ref(User, 'user-1'),
      value: 'azerty',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      expiresAt: new Date('2024-06-01T00:00:00.000Z'),
      disabled: false,
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

  value(value: string) {
    this._props.value = value;
    return this;
  }

  createdAt(createdAt: Date) {
    this._props.createdAt = createdAt;
    return this;
  }

  expiresAt(expiresAt: Date) {
    this._props.expiresAt = expiresAt;
    return this;
  }

  disabled(disabled: boolean) {
    this._props.disabled = disabled;
    return this;
  }

  build() {
    const refreshToken = new RefreshToken();
    Object.assign(refreshToken, this._props);

    return refreshToken;
  }
}
