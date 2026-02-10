import request from 'supertest';
import { Tester } from '../../../config/tester.js';
import {
  expectAccessToken,
  expectRefreshToken,
  expectUser,
} from '../../../utils/login-e2e-expects.js';
import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../../../src/app/application/ports/repositories/user-repository.js';
import { Optional } from '../../../../src/app/libs/shared/optional.js';
import { MemberCodeFixture } from '../../../fixtures/member-code-fixture.js';
import { MemberCodeBuilder } from '../../../../src/app/domain/builders/member-code-builder.js';

describe('Feature: registering', () => {
  const tester = new Tester();

  let memberCode: MemberCodeFixture;

  beforeAll(() => tester.beforeAll());

  beforeEach(async () => {
    memberCode = new MemberCodeFixture(
      new MemberCodeBuilder().code('CODE123').build(),
    );

    await tester.beforeEach();
    await tester.clearDatabase();
    await tester.initialize([memberCode]);
  });

  afterEach(() => tester.afterEach());
  afterAll(() => tester.afterAll());

  it('Scenario: registering without a code', async () => {
    const result = await request(tester.getHttpServer())
      .post('/auth/register')
      .send({
        emailAddress: 'johndoe@gmail.com',
        password: 'azerty',
        lastName: 'Doe',
        gender: 'male',
      })
      .expect(200);

    const userRepository = tester.get<IUserRepository>(I_USER_REPOSITORY);
    const user = await userRepository
      .byEmailAddress('johndoe@gmail.com')
      .then(Optional.getOrThrow());

    expectUser(result.body, user);
    await expectAccessToken(tester, result.body, user);
    await expectRefreshToken(tester, result.body, user);
  });

  it('Scenario: registering with a code', async () => {
    const result = await request(tester.getHttpServer())
      .post('/auth/register')
      .send({
        emailAddress: 'johndoe@gmail.com',
        password: 'azerty',
        lastName: 'Doe',
        gender: 'male',
        code: 'CODE123',
      });

    expect(result.statusCode).toBe(200);

    const userRepository = tester.get<IUserRepository>(I_USER_REPOSITORY);
    const user = await userRepository
      .byEmailAddress('johndoe@gmail.com')
      .then(Optional.getOrThrow());

    expectUser(result.body, user);
    await expectAccessToken(tester, result.body, user);
    await expectRefreshToken(tester, result.body, user);

    expect(user.rank).toBe('member');
  });
});
