import request from 'supertest';
import { Tester } from '../../../config/tester.js';
import { authSeeds } from '../../../seeds/user-seeds.js';
import { placeTypeSeeds } from '../../../seeds/place-type-seeds.js';
import { placeSeeds } from '../../../seeds/place-seeds.js';
import {
  I_PLACE_VIEWED_REPOSITORY,
  IPlaceViewedRepository,
} from '../../../../src/app/application/ports/repositories/place-viewed-repository.js';
import { PlaceFixture } from '../../../fixtures/place-fixture.js';
import { AuthFixture } from '../../../fixtures/auth-fixture.js';

describe('Feature: viewing places', () => {
  const tester = new Tester();
  let place: PlaceFixture;
  let johnDoe: AuthFixture;
  let repository: IPlaceViewedRepository;

  beforeAll(() => tester.beforeAll());

  beforeEach(async () => {
    place = placeSeeds.first();
    johnDoe = authSeeds.johnDoe();

    await tester.beforeEach();
    await tester.initialize([
      authSeeds.anthony(),
      johnDoe,
      placeTypeSeeds.first(),
      placeTypeSeeds.second(),
      place,
      placeSeeds.second(),
    ]);

    repository = tester.get<IPlaceViewedRepository>(I_PLACE_VIEWED_REPOSITORY);
  });

  afterEach(() => tester.afterEach());
  afterAll(() => tester.afterAll());

  it('Scenario: viewing a place', async () => {
    await request(tester.getHttpServer())
      .post('/places/view-place')
      .set('Authorization', johnDoe.authorize())
      .send({
        id: place.id(),
      })
      .expect(200);

    const viewed = await repository.byUserAndPlace(johnDoe.id(), place.id());
    expect(viewed.isPresent()).toBe(true);
  });
});
