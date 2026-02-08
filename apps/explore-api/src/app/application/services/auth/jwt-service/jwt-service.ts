import * as jose from 'jose';
import { DecodeOptions, IJwtService } from './jwt-service.interface.js';
import { Inject, Injectable } from '@nestjs/common';
import { Token } from '../../../../domain/model/token.js';
import {
  I_AUTH_CONFIG,
  IAuthConfig,
} from '../auth-config/auth-config.interface.js';
import {
  I_DATE_PROVIDER,
  IDateProvider,
} from '../../../ports/services/date-provider.interface.js';
import { BadRequestException } from '../../../../libs/exceptions/bad-request-exception.js';
import { FatalException } from '../../../../libs/exceptions/fatal-exception.js';

@Injectable()
export class JwtService implements IJwtService {
  constructor(
    @Inject(I_AUTH_CONFIG) private readonly authConfig: IAuthConfig,
    @Inject(I_DATE_PROVIDER) private readonly dateProvider: IDateProvider,
  ) {}

  async sign<T extends Record<string, any>>(
    payload: T,
    data: {
      issuedAt: Date;
      expiresAt: Date;
    },
  ): Promise<Token> {
    const value = await new jose.SignJWT({ ...payload })
      .setProtectedHeader({
        alg: 'HS256',
        typ: 'JWT',
      })
      .setExpirationTime(data.expiresAt)
      .setIssuedAt(data.issuedAt)
      .setNotBefore(data.issuedAt)
      .sign(new TextEncoder().encode(this.authConfig.getAccessTokenSecret()));

    return new Token(data.issuedAt, data.expiresAt, value);
  }

  async decode<T extends Record<string, any>>(
    token: string,
    options?: DecodeOptions,
  ): Promise<T> {
    try {
      const { payload } = await jose.jwtVerify(
        token,
        new TextEncoder().encode(this.authConfig.getAccessTokenSecret()),
        {
          currentDate: this.dateProvider.now(),
          audience: options?.aud,
        },
      );

      return payload as T;
    } catch (e) {
      if ((e as any).name === 'JWSSignatureVerificationFailed') {
        throw new BadRequestException({
          code: 'JWT_SIGNATURE_VERIFICATION_FAILED',
          message: 'signature verification failed',
        });
      }

      throw new FatalException({
        code: 'JWT_ERROR',
        message: 'Failed to decode JWT : ' + (e as any).message,
        payload: {
          error: e,
        },
      });
    }
  }
}
