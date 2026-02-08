import request from 'supertest';
import { Tester } from '../../../config/tester.js';
import { authSeeds } from '../../../seeds/user-seeds.js';
import { placeTypeSeeds } from '../../../seeds/place-type-seeds.js';
import { placeSeeds } from '../../../seeds/place-seeds.js';
import {
  I_PLACE_BOOKMARKED_REPOSITORY,
  IPlaceBookmarkedRepository,
} from '../../../../src/app/application/ports/repositories/place-bookmarked-repository.js';
import { AuthFixture } from '../../../fixtures/auth-fixture.js';
import { PlaceFixture } from '../../../fixtures/place-fixture.js';

const tester = new Tester();
let place: PlaceFixture;
let johnDoe: AuthFixture;
let repository: IPlaceBookmarkedRepository;

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

  repository = tester.get<IPlaceBookmarkedRepository>(
    I_PLACE_BOOKMARKED_REPOSITORY,
  );
});

afterEach(() => tester.afterEach());
afterAll(() => tester.afterAll());

describe('Feature: bookmarking & un-bookmarked places', () => {
  it('Scenario: bookmarking & un-bookmarking a place', async () => {
    await request(tester.getHttpServer())
      .post('/places/bookmark-place')
      .set('Authorization', johnDoe.authorize())
      .send({
        id: place.id(),
      })
      .expect(200);

    let bookmarked = await repository.byUserAndPlace(johnDoe.id(), place.id());
    expect(bookmarked.isPresent()).toBe(true);

    await request(tester.getHttpServer())
      .delete('/places/remove-bookmark-place')
      .set('Authorization', johnDoe.authorize())
      .send({
        id: place.id(),
      })
      .expect(200);

    bookmarked = await repository.byUserAndPlace(johnDoe.id(), place.id());
    expect(bookmarked.isPresent()).toBe(false);
  });
});
