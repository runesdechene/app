import { ApiAuthenticatedUser } from '../../src/app/application/viewmodels/api-authenticated-user.js';
import { Token } from '../../src/app/domain/model/token.js';
import { User } from '../../src/app/domain/entities/user.js';
import { RefreshToken } from '../../src/app/domain/entities/refresh-token.js';

export const expectUser = (result: ApiAuthenticatedUser, user: User) => {
  expect(result.user).toEqual({
    id: user.id,
    emailAddress: user.emailAddress,
    role: user.role,
    rank: user.rank,
    lastName: user.lastName,
    profileImage: null,
  });
};

export const expectRefreshToken = (
  result: ApiAuthenticatedUser,
  token: RefreshToken,
) => {
  expect(result.refreshToken.value).toBe(token.value);
  expect(result.refreshToken.issuedAt).toBe(token.createdAt);
  expect(result.refreshToken.expiresAt).toBe(token.expiresAt);
};

export const expectAccessToken = (
  result: ApiAuthenticatedUser,
  token: Token,
) => {
  const snapshot = token.snapshot();
  expect(result.accessToken.value).toBe(snapshot.value);
  expect(result.accessToken.issuedAt).toBe(snapshot.issuedAt);
  expect(result.accessToken.expiresAt).toBe(snapshot.expiresAt);
};
