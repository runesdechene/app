import request from 'supertest';
import { Tester } from '../../../config/tester.js';
import { UserBuilder } from '../../../../src/app/domain/builders/user-builder.js';
import { AuthFixture } from '../../../fixtures/auth-fixture.js';
import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../../../src/app/application/ports/repositories/user-repository.js';
import { Optional } from '../../../../src/app/libs/shared/optional.js';
import { Gender } from '../../../../src/app/domain/model/gender.js';

describe('Feature: updating my informations', () => {
  const tester = new Tester();

  let john: AuthFixture;

  beforeAll(() => tester.beforeAll());

  beforeEach(async () => {
    john = new AuthFixture(
      new UserBuilder()
        .id('john-doe')
        .emailAddress('johndoe@gmail.com')
        .password('azerty')
        .lastName('Doe')
        .gender(Gender.MALE)
        .build(),
    );

    await tester.beforeEach();
    await tester.initialize([john]);
  });

  afterEach(() => tester.afterEach());
  afterAll(() => tester.afterAll());

  it('Scenario: change the informations', async () => {
    await request(tester.getHttpServer())
      .post('/auth/change-informations')
      .set('Authorization', john.authorize())
      .send({
        lastName: 'Adler',
        gender: 'female',
      })
      .expect(200);

    const userRepository = tester.get<IUserRepository>(I_USER_REPOSITORY);
    const user = await userRepository
      .byId(john.id())
      .then(Optional.getOrThrow());

    expect(user.lastName).toBe('Adler');
    expect(user.gender).toBe('female');
  });
});
