import { RamUserRepository } from '../../../../../src/adapters/for-tests/database/repositories/ram-user-repository.js';
import { PassthroughPasswordStrategy } from '../../../../../src/app/application/services/auth/password-strategy/passthrough-strategy.js';
import {
  RegisterCommand,
  RegisterCommandHandler,
} from '../../../../../src/app/application/commands/auth/register.js';
import { Optional } from '../../../../../src/app/libs/shared/optional.js';
import { RefreshTokenBuilder } from '../../../../../src/app/domain/builders/refresh-token-builder.js';
import { Token } from '../../../../../src/app/domain/model/token.js';
import { IRefreshTokenManager } from '../../../../../src/app/application/services/auth/refresh-token-manager/refresh-token-manager.interface.js';
import { IAccessTokenFactory } from '../../../../../src/app/application/services/auth/access-token-factory/access-token-factory.interface.js';
import { AccessToken } from '../../../../../src/app/domain/model/access-token.js';
import { ApiAuthenticatedUser } from '../../../../../src/app/application/viewmodels/api-authenticated-user.js';
import { UserBuilder } from '../../../../../src/app/domain/builders/user-builder.js';
import { RamMemberCodeRepository } from '../../../../../src/adapters/for-tests/database/repositories/ram-member-code-repository.js';
import { MemberCodeBuilder } from '../../../../../src/app/domain/builders/member-code-builder.js';
import { expectUser } from '../../../../utils/login-expects.js';
import { FixedIDProvider } from '../../../../../src/adapters/for-tests/services/fixed-id-provider.js';
import { BadRequestException } from '../../../../../src/app/libs/exceptions/bad-request-exception.js';
import { SimpleAuthenticatedUserViewModelFactory } from '../../../../../src/app/application/services/auth/authenticated-user-view-model-factory/simple-authenticated-user-view-model-factory.js';
import { User } from '../../../../../src/app/domain/entities/user.js';
import { RefreshToken } from '../../../../../src/app/domain/entities/refresh-token.js';

class MockRefreshTokenManager implements IRefreshTokenManager {
  private invocations: User[] = [];

  constructor(private readonly token: RefreshToken) {}

  async create(user: User): Promise<RefreshToken> {
    this.invocations.push(user);
    return this.token;
  }

  wasInvokedOnceWith(user: User) {
    return this.invocations.length === 1 && this.invocations[0].id === user.id;
  }

  reset() {
    this.invocations = [];
  }
}

class MockAccessTokenFactory implements IAccessTokenFactory {
  private invocations: User[] = [];

  constructor(private readonly token: AccessToken) {}

  async create(user: User): Promise<AccessToken> {
    this.invocations.push(user);
    return this.token;
  }

  wasInvokedOnceWith(user: User) {
    return this.invocations.length === 1 && this.invocations[0].id === user.id;
  }

  reset() {
    this.invocations = [];
  }
}

describe('Feature: registering', () => {
  const refreshToken = new RefreshTokenBuilder()
    .id('123')
    .userId('some-user')
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

  const existingUser = new UserBuilder()
    .emailAddress('email-taken@gmail.com')
    .build();

  const availableMemberCode = new MemberCodeBuilder().code('CODE123').build();
  const consumedMemberCode = new MemberCodeBuilder()
    .code('CONSUMED')
    .consumed(true)
    .build();

  const userRepository = new RamUserRepository();
  const refreshTokenManager = new MockRefreshTokenManager(refreshToken);
  const accessTokenFactory = new MockAccessTokenFactory(accessToken);
  const memberCodeRepository = new RamMemberCodeRepository();

  const createCommandHandler = () => {
    return new RegisterCommandHandler(
      userRepository,
      new PassthroughPasswordStrategy(),
      new FixedIDProvider(),
      accessTokenFactory,
      refreshTokenManager,
      memberCodeRepository,
      new SimpleAuthenticatedUserViewModelFactory(),
    );
  };

  const createCommand = (data: { emailAddress: string; code?: string }) =>
    new RegisterCommand(null, {
      emailAddress: data.emailAddress,
      password: 'azerty',
      lastName: 'Doe',
      gender: 'male',
      code: data.code ?? null,
    });

  const getUserByEmail = async (emailAddress: string) =>
    userRepository.byEmailAddress(emailAddress).then(Optional.getOrThrow());

  const checkPassword = async (user: User) => {
    const isValid = await user.isPasswordValid(
      new PassthroughPasswordStrategy(),
      'azerty',
    );

    expect(isValid).toBe(true);
  };

  const expectUserToBeCreated = async (
    emailAddress: string,
    command: RegisterCommand,
  ) => {
    const user = await getUserByEmail(emailAddress);

    await checkPassword(user);
    expect(user.isUser());

    const props = command.props();

    expect(user.lastName).toBe(props.lastName);
    expect(user.role).toBe('user');
  };

  const expectUserToBeGuest = async (emailAddress: string) => {
    const user = await getUserByEmail(emailAddress);
    expect(user.isMember()).toBe(false);
  };

  const expectUserToBeMember = async (emailAddress: string) => {
    const user = await getUserByEmail(emailAddress);
    expect(user.isMember()).toBe(true);
  };

  const expectUserToBeReturned = async (
    emailAddress: string,
    result: ApiAuthenticatedUser,
  ) => {
    const user = await getUserByEmail(emailAddress);
    expectUser(result, user);
  };

  const expectRefreshToken = (
    result: ApiAuthenticatedUser,
    refreshToken: RefreshToken,
  ) => {
    expect(result.refreshToken.value).toBe(refreshToken.value);
    expect(result.refreshToken.issuedAt).toBe(refreshToken.createdAt);
    expect(result.refreshToken.expiresAt).toBe(refreshToken.expiresAt);
  };

  const expectAccessToken = (
    result: ApiAuthenticatedUser,
    accessToken: AccessToken,
  ) => {
    expect(result.accessToken.value).toBe(accessToken.value());
    expect(result.accessToken.issuedAt).toBe(accessToken.issuedAt());
    expect(result.accessToken.expiresAt).toBe(accessToken.expiresAt());
  };

  beforeEach(() => {
    accessTokenFactory.reset();
    refreshTokenManager.reset();

    userRepository.reset([existingUser]);
    memberCodeRepository.reset([availableMemberCode, consumedMemberCode]);
  });

  describe('Scenario: happy path', () => {
    const command = createCommand({
      emailAddress: 'johndoe@gmail.com',
    });

    it('should create the user', async () => {
      const result = await createCommandHandler().execute(command);
      const user = await getUserByEmail('johndoe@gmail.com');

      await expectUserToBeCreated('johndoe@gmail.com', command);
      await expectUserToBeReturned('johndoe@gmail.com', result);
      expectRefreshToken(result, refreshToken);
      expectAccessToken(result, accessToken);

      expect(refreshTokenManager.wasInvokedOnceWith(user)).toBe(true);
      expect(accessTokenFactory.wasInvokedOnceWith(user)).toBe(true);
    });

    it('should create the user as a guest', async () => {
      await createCommandHandler().execute(command);
      await expectUserToBeGuest('johndoe@gmail.com');
    });
  });

  describe('Scenario: using a code', () => {
    const command = createCommand({
      emailAddress: 'johndoe@gmail.com',
      code: 'CODE123',
    });

    it('should create the user', async () => {
      const result = await createCommandHandler().execute(command);
      const user = await getUserByEmail('johndoe@gmail.com');

      await expectUserToBeCreated('johndoe@gmail.com', command);
      await expectUserToBeReturned('johndoe@gmail.com', result);
      expectRefreshToken(result, refreshToken);
      expectAccessToken(result, accessToken);

      expect(refreshTokenManager.wasInvokedOnceWith(user)).toBe(true);
      expect(accessTokenFactory.wasInvokedOnceWith(user)).toBe(true);
    });

    it('should create the user as a member', async () => {
      await createCommandHandler().execute(command);
      await expectUserToBeMember('johndoe@gmail.com');
    });

    it('should consume the code', async () => {
      await createCommandHandler().execute(command);

      const code = await memberCodeRepository
        .byCode('CODE123')
        .then(Optional.getOrThrow());

      expect(code.isConsumed).toBe(true);
    });
  });

  describe('Scenario: user already exists', () => {
    const command = createCommand({
      emailAddress: existingUser.emailAddress,
    });

    it('should reject', async () => {
      await expect(createCommandHandler().execute(command)).rejects.toThrow(
        BadRequestException.create(
          'EMAIL_ALREADY_REGISTERED',
          'emailAddress already registered',
        ),
      );
    });
  });

  describe('Scenario: the code does not exist', () => {
    const command = createCommand({
      emailAddress: 'newaccount@gmail.com',
      code: 'NOTFOUND',
    });

    it('should reject', async () => {
      await expect(createCommandHandler().execute(command)).rejects.toThrow(
        BadRequestException.create(
          'INVALID_MEMBER_CODE',
          'Invalid member code',
        ),
      );
    });
  });

  describe('Scenario: the code is already consumed', () => {
    const command = createCommand({
      emailAddress: 'newaccount@gmail.com',
      code: 'CONSUMED',
    });

    it('should reject', async () => {
      await expect(createCommandHandler().execute(command)).rejects.toThrow(
        BadRequestException.create(
          'INVALID_MEMBER_CODE',
          'Invalid member code',
        ),
      );
    });
  });
});
