import request from 'supertest';
import { Tester } from '../../../config/tester.js';
import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../../../src/app/application/ports/repositories/user-repository.js';
import { AuthFixture } from '../../../fixtures/auth-fixture.js';
import { UserBuilder } from '../../../../src/app/domain/builders/user-builder.js';

describe('Feature: deleting my account', () => {
  const tester = new Tester();

  let john: AuthFixture;

  beforeAll(() => tester.beforeAll());

  beforeEach(async () => {
    john = new AuthFixture(new UserBuilder().build());

    await tester.beforeEach();
    await tester.clearDatabase();
    await tester.initialize([john]);
  });

  afterEach(() => tester.afterEach());
  afterAll(() => tester.afterAll());

  it('Scenario: deleting the account', async () => {
    await request(tester.getHttpServer())
      .delete('/auth/delete-account')
      .set('Authorization', john.authorize())
      .send()
      .expect(200);

    const userRepository = tester.get<IUserRepository>(I_USER_REPOSITORY);
    const userExists = await userRepository
      .byId(john.id())
      .then((o) => o.isPresent());

    expect(userExists).toBe(false);
  });
});
