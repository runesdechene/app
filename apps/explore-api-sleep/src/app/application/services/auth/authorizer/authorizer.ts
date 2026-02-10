import {
  I_JWT_SERVICE,
  IJwtService,
} from '../jwt-service/jwt-service.interface.js';
import { AuthContext } from '../../../../domain/model/auth-context.js';
import { Inject } from '@nestjs/common';
import { BadAuthenticationException } from '../../../../libs/exceptions/bad-authentication-exception.js';

export class Authorizer {
  constructor(
    @Inject(I_JWT_SERVICE) private readonly jwtService: IJwtService,
  ) {}

  async check(token: string): Promise<AuthContext> {
    try {
      const payload = await this.jwtService.decode(token, {
        aud: ['api'],
      });

      return new AuthContext({
        userId: payload.sub,
        emailAddress: payload.emailAddress,
        role: payload.role,
        rank: payload.rank,
      });
    } catch (e) {
      throw new BadAuthenticationException('Invalid access token');
    }
  }
}
