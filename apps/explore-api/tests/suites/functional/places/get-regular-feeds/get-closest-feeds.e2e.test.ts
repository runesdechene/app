import request from 'supertest';
import { Tester } from '../../../../config/tester.js';
import { authSeeds } from '../../../../seeds/user-seeds.js';
import { placeTypeSeeds } from '../../../../seeds/place-type-seeds.js';
import { placeSeeds } from '../../../../seeds/place-seeds.js';
import { AuthFixture } from '../../../../fixtures/auth-fixture.js';

describe('Feature: get closest places', () => {
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

  it('Scenario: getting a feed', async () => {
    const result = await request(tester.getHttpServer())
      .post('/places/get-regular-feed')
      .set('Authorization', johnDoe.authorize())
      .send({
        params: {
          type: 'closest',
          latitude: 43.81675,
          longitude: 7.31479,
        },
      })
      .expect(200);

    expect(result.body.meta.page).toBe(1);
    expect(result.body.meta.count).toBe(10);
    expect(result.body.meta.total).toBe(2);

    const ids = result.body.data.map((place) => place.id);
    expect(ids).toEqual([placeSeeds.second().id(), placeSeeds.first().id()]);
  });
});
