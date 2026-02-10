import request from 'supertest';
import { Tester } from '../../../config/tester.js';
import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../../../src/app/application/ports/repositories/user-repository.js';
import { Optional } from '../../../../src/app/libs/shared/optional.js';
import { MemberCodeFixture } from '../../../fixtures/member-code-fixture.js';
import { MemberCodeBuilder } from '../../../../src/app/domain/builders/member-code-builder.js';
import { AuthFixture } from '../../../fixtures/auth-fixture.js';
import { UserBuilder } from '../../../../src/app/domain/builders/user-builder.js';
import { Role } from '../../../../src/app/domain/model/role.js';
import { Rank } from '../../../../src/app/domain/model/rank.js';

describe('Feature: activating the account with a code', () => {
  const tester = new Tester();

  let memberCode: MemberCodeFixture;
  let john: AuthFixture;

  beforeAll(() => tester.beforeAll());

  beforeEach(async () => {
    john = new AuthFixture(
      new UserBuilder()
        .id('john-doe')
        .emailAddress('johndoe@gmail.com')
        .password('azerty')
        .role(Role.USER)
        .rank(Rank.GUEST)
        .lastName('Doe')
        .build(),
    );

    memberCode = new MemberCodeFixture(
      new MemberCodeBuilder().code('CODE123').build(),
    );

    await tester.beforeEach();
    await tester.clearDatabase();
    await tester.initialize([john, memberCode]);
  });

  afterEach(() => tester.afterEach());
  afterAll(() => tester.afterAll());

  it('Scenario: activating the account', async () => {
    await request(tester.getHttpServer())
      .post('/auth/activate-account')
      .set('Authorization', john.authorize())
      .send({
        code: 'CODE123',
      })
      .expect(200);

    const userRepository = tester.get<IUserRepository>(I_USER_REPOSITORY);
    const user = await userRepository
      .byId(john.id())
      .then(Optional.getOrThrow());

    expect(user.isMember()).toBe(true);
  });
});
