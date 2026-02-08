import { ITester } from '../config/tester.interface.js';
import {
  I_JWT_SERVICE,
  IJwtService,
} from '../../src/app/application/services/auth/jwt-service/jwt-service.interface.js';
import {
  I_REFRESH_TOKEN_REPOSITORY,
  IRefreshTokenRepository,
} from '../../src/app/application/ports/repositories/refresh-token-repository.js';
import { Optional } from '../../src/app/libs/shared/optional.js';
import { User } from '../../src/app/domain/entities/user.js';

export const expectUser = (body: Record<string, any>, user: User) => {
  expect(body.user).toEqual({
    id: user.id,
    emailAddress: user.emailAddress,
    role: user.role,
    rank: user.rank,
    lastName: user.lastName,
    profileImage: null,
  });
};

export const expectAccessToken = async (
  tester: ITester,
  body: Record<string, any>,
  user: User,
) => {
  const jwtService = tester.get<IJwtService>(I_JWT_SERVICE);
  const decoded = await jwtService.decode(body.accessToken.value);

  expect(decoded).toMatchObject({
    sub: user.id,
    emailAddress: user.emailAddress,
    role: user.role,
    rank: user.rank,
    lastName: user.lastName,
  });
};

export const expectRefreshToken = async (
  tester: ITester,
  body: Record<string, any>,
  user: User,
) => {
  const refreshTokenRepository = tester.get<IRefreshTokenRepository>(
    I_REFRESH_TOKEN_REPOSITORY,
  );
  const refreshToken = await refreshTokenRepository
    .byValue(body.refreshToken.value)
    .then(Optional.getOrNull());

  expect(refreshToken).not.toBeNull();
};
