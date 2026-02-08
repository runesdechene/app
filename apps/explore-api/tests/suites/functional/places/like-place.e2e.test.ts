import request from 'supertest';
import { Tester } from '../../../config/tester.js';
import { authSeeds } from '../../../seeds/user-seeds.js';
import { placeTypeSeeds } from '../../../seeds/place-type-seeds.js';
import { placeSeeds } from '../../../seeds/place-seeds.js';
import {
  I_PLACE_LIKED_REPOSITORY,
  IPlaceLikedRepository,
} from '../../../../src/app/application/ports/repositories/place-liked-repository.js';
import { AuthFixture } from '../../../fixtures/auth-fixture.js';
import { PlaceFixture } from '../../../fixtures/place-fixture.js';

describe('Feature: liking & disliking places', () => {
  const tester = new Tester();
  let place: PlaceFixture;
  let johnDoe: AuthFixture;
  let repository: IPlaceLikedRepository;

  beforeAll(() => tester.beforeAll());

  beforeEach(async () => {
    johnDoe = authSeeds.johnDoe();
    place = placeSeeds.first();

    await tester.beforeEach();
    await tester.initialize([
      authSeeds.anthony(),
      johnDoe,
      placeTypeSeeds.first(),
      placeTypeSeeds.second(),
      place,
      placeSeeds.second(),
    ]);
    repository = tester.get<IPlaceLikedRepository>(I_PLACE_LIKED_REPOSITORY);
  });

  afterEach(() => tester.afterEach());
  afterAll(() => tester.afterAll());

  it('Scenario: liking & disliking a place', async () => {
    await request(tester.getHttpServer())
      .post('/places/like-place')
      .set('Authorization', johnDoe.authorize())
      .send({
        id: place.id(),
      })
      .expect(200);

    let liked = await repository.byUserAndPlace(johnDoe.id(), place.id());
    expect(liked.isPresent()).toBe(true);

    await request(tester.getHttpServer())
      .delete('/places/remove-like-place')
      .set('Authorization', johnDoe.authorize())
      .send({
        id: place.id(),
      })
      .expect(200);

    liked = await repository.byUserAndPlace(johnDoe.id(), place.id());
    expect(liked.isPresent()).toBe(false);
  });
});
