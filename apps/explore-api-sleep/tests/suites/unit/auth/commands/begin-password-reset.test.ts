import {
  BeginPasswordResetCommand,
  BeginPasswordResetCommandHandler,
} from '../../../../../src/app/application/commands/auth/begin-password-reset.js';
import { RamUserRepository } from '../../../../../src/adapters/for-tests/database/repositories/ram-user-repository.js';
import { UserBuilder } from '../../../../../src/app/domain/builders/user-builder.js';
import { RamPasswordResetRepository } from '../../../../../src/adapters/for-tests/database/repositories/ram-password-reset-repository.js';
import { IPassworResetCodeGenerator } from '../../../../../src/app/application/services/auth/password-reset-code-generator/password-reset-code-generator.interface.js';
import { Optional } from '../../../../../src/app/libs/shared/optional.js';
import { Duration } from '../../../../../src/app/libs/shared/duration.js';
import { MockMailer } from '../../../../config/mock-mailer.js';
import { TranslatorFactory } from '../../../../utils/translator-factory.js';
import { FixedIDProvider } from '../../../../../src/adapters/for-tests/services/fixed-id-provider.js';
import { FixedDateProvider } from '../../../../../src/adapters/for-tests/services/fixed-date-provider.js';
import { NotFoundException } from '../../../../../src/app/libs/exceptions/not-found-exception.js';
import { PasswordReset } from '../../../../../src/app/domain/entities/password-reset.js';

class MockPasswordResetCodeGenerator implements IPassworResetCodeGenerator {
  code() {
    return '123';
  }

  generate() {
    return this.code();
  }
}

describe('Feature: begin password reset', () => {
  const user = new UserBuilder()
    .id('user-1')
    .emailAddress('johndoe@gmail.com')
    .password('azerty')
    .build();

  const userRepository = new RamUserRepository([user]);
  const passwordResetRepository = new RamPasswordResetRepository();
  const idProvider = new FixedIDProvider();
  const dateProvider = new FixedDateProvider();
  const mailer = new MockMailer();
  const passwordResetCodeGenerator: MockPasswordResetCodeGenerator =
    new MockPasswordResetCodeGenerator();

  const createCommand = (emailAddress: string) =>
    new BeginPasswordResetCommand(null, { emailAddress });

  const createHandler = () =>
    new BeginPasswordResetCommandHandler(
      userRepository,
      passwordResetRepository,
      passwordResetCodeGenerator,
      idProvider,
      dateProvider,
      TranslatorFactory.create(),
      mailer,
    );

  const expectCode = (code: Optional<PasswordReset>) => {
    expect(code.isPresent()).toBe(true);
  };

  beforeEach(() => {
    userRepository.reset([user]);
    passwordResetRepository.clear();
    mailer.reset();
  });

  test('rejecting when the e-mail is invalid', () => {
    expect(() => createCommand('not-valid')).toThrow();
  });

  test('rejecting when the user is not found', async () => {
    await expect(
      createHandler().execute(createCommand('doesnotexist@gmail.com')),
    ).rejects.toThrow(new NotFoundException('User not found'));
  });

  test('assigning a unique code to the password reset', async () => {
    await createHandler().execute(createCommand('johndoe@gmail.com'));

    const code = await passwordResetRepository.byCode(
      passwordResetCodeGenerator.code(),
    );

    expectCode(code);
  });

  test('assigning a unique id to the password reset', async () => {
    await createHandler().execute(createCommand('johndoe@gmail.com'));

    const code = passwordResetRepository.byIdSync(idProvider.ID);

    expectCode(code);
  });

  test('the password reset should expire in 2 hours', async () => {
    await createHandler().execute(createCommand('johndoe@gmail.com'));

    const code = passwordResetRepository.byIdSync(idProvider.ID).getOrThrow();

    const expectedDate = Duration.fromHours(2).addToDate(dateProvider.now());
    expect(code.expiresAt).toEqual(expectedDate);
  });

  test('an e-mail should be sent', async () => {
    await createHandler().execute(createCommand('johndoe@gmail.com'));

    expect(mailer.containsExactly(1)).toBe(true);
  });

  test('the e-mail should contain the reset informations', async () => {
    await createHandler().execute(createCommand('johndoe@gmail.com'));

    const message = mailer.firstMessage();
    expect(message.from.email).toBe('noreply@guildedesvoyageurs.fr');
    expect(message.from.name).toBe('Guilde des Voyageurs');
    expect(message.to.email).toBe(user.emailAddress);
    expect(message.subject.value).toBe('Réinitialisation de mot de passe');
    expect(message.header('X-Password-Reset-Code')!.value).toBe(
      passwordResetCodeGenerator.code(),
    );
    expect(message.body.html.includes(passwordResetCodeGenerator.code())).toBe(
      true,
    );
  });
});
