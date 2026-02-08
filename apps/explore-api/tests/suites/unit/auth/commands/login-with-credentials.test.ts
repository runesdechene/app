import { RamUserRepository } from '../../../../../src/adapters/for-tests/database/repositories/ram-user-repository.js';
import {
  LoginWithCredentialsCommand,
  LoginWithCredentialsCommandHandler,
} from '../../../../../src/app/application/commands/auth/login-with-credentials.js';
import { PassthroughPasswordStrategy } from '../../../../../src/app/application/services/auth/password-strategy/passthrough-strategy.js';
import { UserBuilder } from '../../../../../src/app/domain/builders/user-builder.js';
import { RefreshTokenBuilder } from '../../../../../src/app/domain/builders/refresh-token-builder.js';
import { Token } from '../../../../../src/app/domain/model/token.js';
import { RefreshTokenManagerMock } from '../../../../mocks/refresh-token-factory-mock.js';
import { AccessTokenFactoryMock } from '../../../../mocks/access-token-factory-mock.js';
import {
  expectAccessToken,
  expectRefreshToken,
  expectUser,
} from '../../../../utils/login-expects.js';
import { SimpleAuthenticatedUserViewModelFactory } from '../../../../../src/app/application/services/auth/authenticated-user-view-model-factory/simple-authenticated-user-view-model-factory.js';

describe('Feature: login with credentials', () => {
  const user = new UserBuilder()
    .id('user-1')
    .emailAddress('johndoe@gmail.com')
    .password('azerty')
    .build();

  const refreshToken = new RefreshTokenBuilder()
    .id('123')
    .userId(user.id)
    .value('refresh-token')
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

  const createCommandHandler = () => {
    return new LoginWithCredentialsCommandHandler(
      userRepository,
      new PassthroughPasswordStrategy(),
      new RefreshTokenManagerMock(user, refreshToken),
      new AccessTokenFactoryMock(user, accessToken),
      new SimpleAuthenticatedUserViewModelFactory(),
    );
  };

  describe('Scenario: happy path', () => {
    const command = new LoginWithCredentialsCommand(null, {
      emailAddress: 'johndoe@gmail.com',
      password: 'azerty',
    });

    it('should return the user credentials', async () => {
      const result = await createCommandHandler().execute(command);
      expectUser(result, user);
    });

    it('should return a refresh token', async () => {
      const result = await createCommandHandler().execute(command);
      expectRefreshToken(result, refreshToken);
    });

    it('should return an access token', async () => {
      const result = await createCommandHandler().execute(command);
      expectAccessToken(result, accessToken);
    });
  });

  describe('Scenario: the user does not exist', () => {
    const command = new LoginWithCredentialsCommand(null, {
      emailAddress: 'whodis@gmail.com',
      password: 'azerty',
    });

    it('should reject', async () => {
      const handler = createCommandHandler();
      await expect(() => handler.execute(command)).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('Scenario: the password is invalid', () => {
    const command = new LoginWithCredentialsCommand(null, {
      emailAddress: 'johndoe@gmail.com',
      password: 'wrong-password',
    });

    it('should reject', async () => {
      const handler = createCommandHandler();
      await expect(() => handler.execute(command)).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });
});
