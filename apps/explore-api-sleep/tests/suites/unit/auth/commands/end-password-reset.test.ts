import { UserBuilder } from '../../../../../src/app/domain/builders/user-builder.js';
import { RamUserRepository } from '../../../../../src/adapters/for-tests/database/repositories/ram-user-repository.js';
import { RamPasswordResetRepository } from '../../../../../src/adapters/for-tests/database/repositories/ram-password-reset-repository.js';
import { MockMailer } from '../../../../config/mock-mailer.js';
import {
  EndPasswordResetCommand,
  EndPasswordResetCommandHandler,
} from '../../../../../src/app/application/commands/auth/end-password-reset.js';
import { PasswordResetBuilder } from '../../../../../src/app/domain/builders/password-reset-builder.js';
import { IPasswordStrategy } from '../../../../../src/app/application/services/auth/password-strategy/password-strategy.interface.js';
import { PassthroughPasswordStrategy } from '../../../../../src/app/application/services/auth/password-strategy/passthrough-strategy.js';
import { TranslatorFactory } from '../../../../utils/translator-factory.js';
import { FixedDateProvider } from '../../../../../src/adapters/for-tests/services/fixed-date-provider.js';
import { BadRequestException } from '../../../../../src/app/libs/exceptions/bad-request-exception.js';

class MockPasswordStrategy implements IPasswordStrategy {
  private called = false;

  constructor(private readonly expectedPassword: string) {}

  async hash(password: string): Promise<string> {
    expect(password).toBe(this.expectedPassword);
    this.called = true;
    return 'hashed:' + password;
  }

  wasHashed() {
    return this.called;
  }

  async equals(): Promise<any> {
    throw new Error('Should not be invoked');
  }
}

describe('Feature: ending password reset', () => {
  const user = new UserBuilder()
    .emailAddress('johndoe@gmail.com')
    .password('azerty')
    .build();

  const passwordReset = new PasswordResetBuilder()
    .userId(user.id)
    .code('CODE12')
    .expiresAt(new Date('2024-02-01T00:00:00.000Z'))
    .build();

  const expiredPasswordReset = new PasswordResetBuilder()
    .userId(user.id)
    .code('CODE34')
    .expiresAt(new Date('2023-01-01T00:00:00.000Z'))
    .build();

  const consumedPasswordReset = new PasswordResetBuilder()
    .userId(user.id)
    .code('CODE56')
    .consumed(true)
    .expiresAt(new Date('2024-02-01T00:00:00.000Z'))
    .build();

  const userRepository = new RamUserRepository();
  const passwordResetRepository = new RamPasswordResetRepository();
  const mailer = new MockMailer();

  const createCommand = (code: string, nextPassword: string) =>
    new EndPasswordResetCommand(null, { code, nextPassword });

  const createHandler = (props?: { passwordStrategy: IPasswordStrategy }) => {
    const passwordStrategy =
      props?.passwordStrategy ?? new PassthroughPasswordStrategy();

    return new EndPasswordResetCommandHandler(
      userRepository,
      passwordResetRepository,
      passwordStrategy,
      TranslatorFactory.create(),
      mailer,
      new FixedDateProvider(),
    );
  };

  beforeEach(() => {
    userRepository.reset([user]);
    passwordResetRepository.reset([
      passwordReset,
      expiredPasswordReset,
      consumedPasswordReset,
    ]);
    mailer.reset();
  });

  describe('Scenario: the code is valid', () => {
    const command = createCommand(passwordReset.code, 'next-password');

    it('should hash the password', async () => {
      const passwordStrategy = new MockPasswordStrategy('next-password');
      const handler = createHandler({
        passwordStrategy,
      });

      await handler.execute(command);

      expect(passwordStrategy.wasHashed()).toBe(true);
    });

    it('should change the user password', async () => {
      const passwordStrategy = new MockPasswordStrategy('next-password');
      const handler = createHandler({
        passwordStrategy,
      });

      await handler.execute(command);

      const nextUser = userRepository.byIdSync(user.id).getOrThrow();
      expect(nextUser.password).toBe('hashed:next-password');
    });

    it('should consume the password reset', async () => {
      await createHandler().execute(command);

      const nextPasswordReset = passwordResetRepository
        .byIdSync(passwordReset.id)
        .getOrThrow();

      expect(nextPasswordReset.isConsumed).toBe(true);
    });

    it('should send an e-mail', async () => {
      await createHandler().execute(command);

      const message = mailer.firstMessage();
      expect(message.from.email).toBe('noreply@guildedesvoyageurs.fr');
      expect(message.from.name).toBe('Guilde des Voyageurs');
      expect(message.to.email).toBe(user.emailAddress);
      expect(message.subject.value).toBe('Mot de passe réinitialisé');
    });
  });

  describe('Scenario: the code is invalid', () => {
    const command = createCommand('123456', 'next-password');

    it('should reject', () => {
      expect(() => createHandler().execute(command)).rejects.toThrow(
        BadRequestException.create('INVALID_CODE', 'Invalid code'),
      );
    });
  });

  describe('Scenario: the code has expired', () => {
    const command = createCommand(expiredPasswordReset.code, 'next-password');

    it('should reject', () => {
      expect(() => createHandler().execute(command)).rejects.toThrow(
        BadRequestException.create('EXPIRED_CODE', 'The code has expired'),
      );
    });
  });

  describe('Scenario: the code has been consumed', () => {
    const command = createCommand(consumedPasswordReset.code, 'next-password');

    it('should reject', () => {
      expect(() => createHandler().execute(command)).rejects.toThrow(
        BadRequestException.create(
          'CONSUMED_CODE',
          'The code has been consumed',
        ),
      );
    });
  });
});
