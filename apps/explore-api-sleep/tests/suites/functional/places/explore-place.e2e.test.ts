import request from 'supertest';
import { Tester } from '../../../config/tester.js';
import { authSeeds } from '../../../seeds/user-seeds.js';
import { placeTypeSeeds } from '../../../seeds/place-type-seeds.js';
import { placeSeeds } from '../../../seeds/place-seeds.js';
import {
  I_PLACE_EXPLORED_REPOSITORY,
  IPlaceExploredRepository,
} from '../../../../src/app/application/ports/repositories/place-explored-repository.js';
import { AuthFixture } from '../../../fixtures/auth-fixture.js';
import { PlaceFixture } from '../../../fixtures/place-fixture.js';

describe('Feature: exploring & un-exploring places', () => {
  const tester = new Tester();
  let place: PlaceFixture;
  let john: AuthFixture;
  let repository: IPlaceExploredRepository;

  beforeAll(() => tester.beforeAll());

  beforeEach(async () => {
    john = authSeeds.johnDoe();
    place = placeSeeds.first();

    await tester.beforeEach();
    await tester.initialize([
      authSeeds.anthony(),
      john,
      placeTypeSeeds.first(),
      placeTypeSeeds.second(),
      place,
      placeSeeds.second(),
    ]);

    repository = tester.get<IPlaceExploredRepository>(
      I_PLACE_EXPLORED_REPOSITORY,
    );
  });

  afterEach(() => tester.afterEach());
  afterAll(() => tester.afterAll());

  it('Scenario: exploring & un-exploring a place', async () => {
    await request(tester.getHttpServer())
      .post('/places/explore-place')
      .set('Authorization', john.authorize())
      .send({
        id: place.id(),
      })
      .expect(200);

    let explored = await repository.byUserAndPlace(john.id(), place.id());
    expect(explored.isPresent()).toBe(true);

    await request(tester.getHttpServer())
      .delete('/places/remove-explore-place')
      .set('Authorization', john.authorize())
      .send({
        id: place.id(),
      })
      .expect(200);

    explored = await repository.byUserAndPlace(john.id(), place.id());
    expect(explored.isPresent()).toBe(false);
  });
});
