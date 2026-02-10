import request from 'supertest';
import { Tester } from '../../../config/tester.js';
import { UserBuilder } from '../../../../src/app/domain/builders/user-builder.js';
import { AuthFixture } from '../../../fixtures/auth-fixture.js';
import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../../../src/app/application/ports/repositories/user-repository.js';
import {
  I_PASSWORD_STRATEGY,
  IPasswordStrategy,
} from '../../../../src/app/application/services/auth/password-strategy/password-strategy.interface.js';
import { Optional } from '../../../../src/app/libs/shared/optional.js';

describe('Feature: resetting the password', () => {
  const tester = new Tester();

  let john: AuthFixture;

  beforeAll(() => tester.beforeAll());

  beforeEach(async () => {
    john = new AuthFixture(
      new UserBuilder()
        .id('john-doe')
        .emailAddress('johndoe@gmail.com')
        .password('azerty')
        .build(),
    );

    await tester.beforeEach();
    await tester.initialize([john]);
  });

  afterEach(() => tester.afterEach());
  afterAll(() => tester.afterAll());

  test('Scenario: resetting the password', async () => {
    await request(tester.getHttpServer())
      .post('/auth/begin-password-reset')
      .send({
        emailAddress: john.emailAddress(),
      })
      .expect(200);

    const message = tester.getMailTester().assertOnlyOne();
    const codeHeader = message.header('X-Password-Reset-Code');

    expect(codeHeader).toBeDefined();

    const code = codeHeader!.value;

    await request(tester.getHttpServer())
      .post('/auth/end-password-reset')
      .send({
        code,
        nextPassword: 'new-password',
      })
      .expect(200);

    const userRepository = tester.get<IUserRepository>(I_USER_REPOSITORY);
    const passwordStrategy = tester.get<IPasswordStrategy>(I_PASSWORD_STRATEGY);
    const nextUser = await userRepository
      .byId(john.id())
      .then(Optional.getOrThrow());

    const isValid = await nextUser.isPasswordValid(
      passwordStrategy,
      'new-password',
    );

    expect(isValid).toBe(true);
  });
});
