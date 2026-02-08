import { Token } from './token.js';

export type AccessTokenPayload = {
  aud: string;
  sub: string;
  emailAddress: string;
  role: string;
  rank: string;
  lastName: string;
};

export class AccessToken extends Token {}
