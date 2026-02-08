import { Token } from '../../../../domain/model/token.js';

export const I_JWT_SERVICE = Symbol('I_JWT_SERVICE');

export type SignOptions = {
  aud: string;
};

export type DecodeOptions = {
  aud?: string[];
};

export type JwtToken<T> = T & {
  iat: number;
  exp: number;
  aud: string;
};

/**
 * Low-level API to create JWTs
 * Must be used by a higher-level service to be useful
 */
export interface IJwtService {
  sign<T>(
    payload: T & SignOptions,
    data: {
      issuedAt: Date;
      expiresAt: Date;
    },
  ): Promise<Token>;

  decode<T extends Record<string, any>>(
    token: string,
    options?: DecodeOptions,
  ): Promise<JwtToken<T>>;
}
