import { IAuthConfig } from './auth-config.interface.js';
import { Duration } from '../../../../libs/shared/duration.js';

export class TestAuthConfig implements IAuthConfig {
  getRefreshTokenLifetime() {
    return Duration.fromSeconds(120);
  }

  getAccessTokenLifetime() {
    return Duration.fromSeconds(60);
  }

  getAccessTokenSecret() {
    return 'super-secret-key';
  }
}
