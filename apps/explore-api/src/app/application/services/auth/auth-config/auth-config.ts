import { IAuthConfig } from './auth-config.interface.js';
import { Duration } from '../../../../libs/shared/duration.js';

export class AuthConfig implements IAuthConfig {
  constructor(
    private readonly props: {
      refreshTokenLifetime: Duration;
      accessTokenLifetime: Duration;
      accessTokenSecret: string;
    },
  ) {}

  getRefreshTokenLifetime() {
    return this.props.refreshTokenLifetime;
  }

  getAccessTokenLifetime() {
    return this.props.accessTokenLifetime;
  }

  getAccessTokenSecret() {
    return this.props.accessTokenSecret;
  }
}
