import request from 'supertest';
import { Tester } from '../../../config/tester.js';
import { UserBuilder } from '../../../../src/app/domain/builders/user-builder.js';
import {
  expectAccessToken,
  expectRefreshToken,
  expectUser,
} from '../../../utils/login-e2e-expects.js';
import { AuthFixture } from '../../../fixtures/auth-fixture.js';

describe('Feature: login with refresh token', () => {
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

  it('Scenario: logging the user correctly', async () => {
    const result = await request(tester.getHttpServer())
      .post('/auth/login-with-refresh-token')
      .send({
        value: john.refreshTokenValue(),
      })
      .expect(200);

    expectUser(result.body, john.raw());
    await expectAccessToken(tester, result.body, john.raw());
    await expectRefreshToken(tester, result.body, john.raw());
  });
});
