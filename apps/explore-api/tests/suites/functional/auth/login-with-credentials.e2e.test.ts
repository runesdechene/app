import request from 'supertest';
import { Tester } from '../../../config/tester.js';
import { UserBuilder } from '../../../../src/app/domain/builders/user-builder.js';
import { UserFixture } from '../../../fixtures/user-fixture.js';
import {
  expectAccessToken,
  expectRefreshToken,
  expectUser,
} from '../../../utils/login-e2e-expects.js';

describe('Feature: login with credentials', () => {
  const tester = new Tester();

  let john: UserFixture;
  beforeAll(async () => {
    await tester.beforeAll();
  });

  beforeEach(async () => {
    john = new UserFixture(
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

  it('Scenario: logging the user correctly', async () => {
    const result = await request(tester.getHttpServer())
      .post('/auth/login-with-credentials')
      .send({
        emailAddress: 'johndoe@gmail.com',
        password: 'azerty',
      })
      .expect(200);

    expectUser(result.body, john.raw());
    await expectAccessToken(tester, result.body, john.raw());
    await expectRefreshToken(tester, result.body, john.raw());
  });
});
