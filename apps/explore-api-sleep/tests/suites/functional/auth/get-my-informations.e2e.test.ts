import request from 'supertest';
import { Tester } from '../../../config/tester.js';
import { UserBuilder } from '../../../../src/app/domain/builders/user-builder.js';
import { AuthFixture } from '../../../fixtures/auth-fixture.js';

describe('Feature: getting my personal informations', () => {
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
        .build(),
    );

    await tester.beforeEach();
    await tester.initialize([john]);
  });

  afterEach(() => tester.afterEach());
  afterAll(() => tester.afterAll());

  it('Scenario: returning the correct informations', async () => {
    const result = await request(tester.getHttpServer())
      .get('/auth/get-my-informations')
      .set('Authorization', john.authorize())
      .expect(200);

    expect(result.body).toEqual({
      id: 'john-doe',
      emailAddress: 'johndoe@gmail.com',
      role: 'user',
      rank: 'guest',
      lastName: 'Doe',
      gender: 'male',
      biography: '',
      profileImage: null,
      instagramId: null,
      websiteUrl: null
    });
  });
});
