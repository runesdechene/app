import { Duration } from '../../../../libs/shared/duration.js';

export const I_AUTH_CONFIG = Symbol('I_AUTH_CONFIG');

export interface IAuthConfig {
  getRefreshTokenLifetime(): Duration;

  getAccessTokenLifetime(): Duration;

  getAccessTokenSecret(): string;
}
