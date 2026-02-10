import request from 'supertest';
import { Tester } from '../../../../config/tester.js';
import { authSeeds } from '../../../../seeds/user-seeds.js';
import { placeTypeSeeds } from '../../../../seeds/place-type-seeds.js';
import { placeSeeds } from '../../../../seeds/place-seeds.js';
import { AuthFixture } from '../../../../fixtures/auth-fixture.js';

describe('Feature: get all places', () => {
  const tester = new Tester();
  let johnDoe: AuthFixture;

  beforeAll(() => tester.beforeAll());

  beforeEach(async () => {
    johnDoe = authSeeds.johnDoe();

    await tester.beforeEach();
    await tester.initialize([
      authSeeds.anthony(),
      johnDoe,
      placeTypeSeeds.first(),
      placeTypeSeeds.second(),
      placeSeeds.first(),
      placeSeeds.second(),
    ]);
  });

  afterEach(() => tester.afterEach());
  afterAll(() => tester.afterAll());

  it('Scenario: getting places', async () => {
    const result = await request(tester.getHttpServer())
      .post('/places/get-map-places')
      .set('Authorization', johnDoe.authorize())
      .send({
        params: {
          type: 'all',
        },
      })
      .expect(200);

    const ids = result.body.map((place) => place.id);
    expect(ids).toEqual([placeSeeds.first().id(), placeSeeds.second().id()]);
  });
});
