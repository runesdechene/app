import {
  LoginWithRefreshTokenCommand,
  LoginWithRefreshTokenCommandHandler,
} from '../../../../../src/app/application/commands/auth/login-with-refresh-token.js';
import { UserBuilder } from '../../../../../src/app/domain/builders/user-builder.js';
import { RefreshTokenBuilder } from '../../../../../src/app/domain/builders/refresh-token-builder.js';
import { Token } from '../../../../../src/app/domain/model/token.js';
import { AccessTokenFactoryMock } from '../../../../mocks/access-token-factory-mock.js';
import { RamUserRepository } from '../../../../../src/adapters/for-tests/database/repositories/ram-user-repository.js';
import { RamRefreshTokenRepository } from '../../../../../src/adapters/for-tests/database/repositories/ram-refresh-token-repository.js';
import {
  expectAccessToken,
  expectRefreshToken,
  expectUser,
} from '../../../../utils/login-expects.js';
import { FixedDateProvider } from '../../../../../src/adapters/for-tests/services/fixed-date-provider.js';
import { SimpleAuthenticatedUserViewModelFactory } from '../../../../../src/app/application/services/auth/authenticated-user-view-model-factory/simple-authenticated-user-view-model-factory.js';

describe('Feature: login with refresh token', () => {
  const user = new UserBuilder()
    .id('user-1')
    .emailAddress('johndoe@gmail.com')
    .password('azerty')
    .build();

  const validRefreshToken = new RefreshTokenBuilder()
    .id('token-1')
    .userId(user.id)
    .value('refresh-token-1')
    .createdAt(new Date('2024-01-01T00:00:00.000Z'))
    .expiresAt(new Date('2024-01-02T00:00:00.000Z'))
    .disabled(false)
    .build();

  const expiredRefreshToken = new RefreshTokenBuilder()
    .id('token-2')
    .userId(user.id)
    .value('refresh-token-2')
    .createdAt(new Date('2010-01-01T00:00:00.000Z'))
    .expiresAt(new Date('2010-01-02T00:00:00.000Z'))
    .disabled(false)
    .build();

  const disabledRefreshToken = new RefreshTokenBuilder()
    .id('token-3')
    .userId(user.id)
    .value('refresh-token-3')
    .createdAt(new Date('2024-01-01T00:00:00.000Z'))
    .expiresAt(new Date('2024-01-02T00:00:00.000Z'))
    .disabled(true)
    .build();

  const validRefreshTokenWithNoUser = new RefreshTokenBuilder()
    .id('token-4')
    .userId('garbage-user')
    .value('refresh-token-4')
    .createdAt(new Date('2024-01-01T00:00:00.000Z'))
    .expiresAt(new Date('2024-01-02T00:00:00.000Z'))
    .disabled(false)
    .build();

  const accessToken = new Token(
    new Date('2024-01-01T00:00:00.000Z'),
    new Date('2024-01-02T00:00:00.000Z'),
    'access-token',
  );

  const userRepository = new RamUserRepository([user]);
  const refreshTokenRepository = new RamRefreshTokenRepository([
    validRefreshToken,
    expiredRefreshToken,
    disabledRefreshToken,
    validRefreshTokenWithNoUser,
  ]);

  const createCommandHandler = () => {
    return new LoginWithRefreshTokenCommandHandler(
      new FixedDateProvider(),
      userRepository,
      refreshTokenRepository,
      new AccessTokenFactoryMock(user, accessToken),
      new SimpleAuthenticatedUserViewModelFactory(),
    );
  };

  describe('Scenario: happy path', () => {
    const command = new LoginWithRefreshTokenCommand(null, {
      value: validRefreshToken.value,
    });

    it('should return the user credentials', async () => {
      const result = await createCommandHandler().execute(command);
      expectUser(result, user);
    });

    it('should return a refresh token', async () => {
      const result = await createCommandHandler().execute(command);
      expectRefreshToken(result, validRefreshToken);
    });

    it('should return an access token', async () => {
      const result = await createCommandHandler().execute(command);
      expectAccessToken(result, accessToken);
    });

    it('the refresh token must be the one passed as parameter', async () => {
      const result = await createCommandHandler().execute(command);
      expect(result.refreshToken.value).toBe(validRefreshToken.value);
    });
  });

  describe('Scenario: the refresh token does not exist', () => {
    const command = new LoginWithRefreshTokenCommand(null, {
      value: 'garbage',
    });

    it('should reject', async () => {
      const handler = createCommandHandler();
      await expect(() => handler.execute(command)).rejects.toThrow(
        'Refresh token not found',
      );
    });
  });

  describe('Scenario: the refresh token has expired', () => {
    const command = new LoginWithRefreshTokenCommand(null, {
      value: expiredRefreshToken.value,
    });

    it('should reject', async () => {
      const handler = createCommandHandler();
      await expect(() => handler.execute(command)).rejects.toThrow(
        'Refresh token has expired',
      );
    });
  });

  describe('Scenario: the refresh token is disabled', () => {
    const command = new LoginWithRefreshTokenCommand(null, {
      value: disabledRefreshToken.value,
    });

    it('should reject', async () => {
      const handler = createCommandHandler();
      await expect(() => handler.execute(command)).rejects.toThrow(
        'Refresh token is invalid',
      );
    });
  });

  describe('Scenario: the refresh token is bound inexisting user', () => {
    const command = new LoginWithRefreshTokenCommand(null, {
      value: validRefreshTokenWithNoUser.value,
    });

    it('should reject', async () => {
      const handler = createCommandHandler();
      await expect(() => handler.execute(command)).rejects.toThrow(
        'User not found',
      );
    });
  });
});
