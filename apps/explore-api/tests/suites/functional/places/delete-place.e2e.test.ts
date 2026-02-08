import request from 'supertest';
import { Tester } from '../../../config/tester.js';
import { authSeeds } from '../../../seeds/user-seeds.js';
import { placeTypeSeeds } from '../../../seeds/place-type-seeds.js';
import { placeSeeds } from '../../../seeds/place-seeds.js';
import {
  I_PLACE_REPOSITORY,
  IPlaceRepository,
} from '../../../../src/app/application/ports/repositories/place-repository.js';
import { PlaceFixture } from '../../../fixtures/place-fixture.js';
import { AuthFixture } from '../../../fixtures/auth-fixture.js';

describe('Feature: deleting a place', () => {
  const tester = new Tester();
  let repository: IPlaceRepository;
  let johnDoe: AuthFixture;
  let anthony: AuthFixture;
  let johnDoePlace: PlaceFixture;
  let anthonyPlace: PlaceFixture;

  beforeAll(() => tester.beforeAll());

  beforeEach(async () => {
    johnDoe = authSeeds.johnDoe();
    johnDoePlace = placeSeeds.johnDoePlace();
    anthony = authSeeds.anthony();
    anthonyPlace = placeSeeds.anthonyPlace();

    await tester.beforeEach();
    await tester.clearDatabase();
    await tester.initialize([
      johnDoe,
      anthony,
      placeTypeSeeds.first(),
      placeTypeSeeds.second(),
      johnDoePlace,
      anthonyPlace,
    ]);

    repository = tester.get<IPlaceRepository>(I_PLACE_REPOSITORY);
  });

  afterEach(() => tester.afterEach());
  afterAll(() => tester.afterAll());

  describe('Scenario: deleting a place', () => {
    it('should delete the place', async () => {
      const placeId = johnDoePlace.id();

      await request(tester.getHttpServer())
        .delete('/places/delete-place')
        .set('Authorization', johnDoe.authorize())
        .send({
          id: placeId,
        })
        .expect(200);

      const query = await repository.byId(placeId);
      expect(query.isPresent()).toBe(false);
    });
  });

  describe('ScenarioGroup: Authorization', () => {
    describe('Scenario: deleting someone else place', () => {
      it('should be forbidden', async () => {
        const placeId = anthonyPlace.id();

        await request(tester.getHttpServer())
          .delete('/places/delete-place')
          .set('Authorization', johnDoe.authorize())
          .send({
            id: placeId,
          })
          .expect(403);

        const query = await repository.byId(placeId);
        expect(query.isPresent()).toBe(true);
      });
    });

    describe('Scenario: deleting someone else place as an admin', () => {
      it('should be authorized', async () => {
        const placeId = johnDoePlace.id();

        const result = await request(tester.getHttpServer())
          .delete('/places/delete-place')
          .set('Authorization', anthony.authorize())
          .send({
            id: placeId,
          });

        expect(result.statusCode).toBe(200);
        const query = await repository.byId(placeId);
        expect(query.isPresent()).toBe(false);
      });
    });
  });
});
