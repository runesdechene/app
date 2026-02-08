import request from 'supertest';
import { Tester } from '../../../config/tester.js';
import { UserBuilder } from '../../../../src/app/domain/builders/user-builder.js';
import { AuthFixture } from '../../../fixtures/auth-fixture.js';
import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../../../src/app/application/ports/repositories/user-repository.js';
import { Optional } from '../../../../src/app/libs/shared/optional.js';
import {
  I_PASSWORD_STRATEGY,
  IPasswordStrategy,
} from '../../../../src/app/application/services/auth/password-strategy/password-strategy.interface.js';

describe('Feature: changing password', () => {
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

  it('Scenario: change the password', async () => {
    await request(tester.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', john.authorize())
      .send({
        newPassword: 'Qwerty123',
      })
      .expect(200);

    const userRepository = tester.get<IUserRepository>(I_USER_REPOSITORY);
    const user = await userRepository
      .byId(john.id())
      .then(Optional.getOrThrow());

    const passwordStrategy = tester.get<IPasswordStrategy>(I_PASSWORD_STRATEGY);

    expect(await user.isPasswordValid(passwordStrategy, 'Qwerty123')).toBe(
      true,
    );
  });
});
