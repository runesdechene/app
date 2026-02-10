import request from 'supertest';
import { Tester } from '../../../config/tester.js';
import { authSeeds } from '../../../seeds/user-seeds.js';
import { placeTypeSeeds } from '../../../seeds/place-type-seeds.js';
import { placeSeeds } from '../../../seeds/place-seeds.js';
import {
  I_PLACE_REPOSITORY,
  IPlaceRepository,
} from '../../../../src/app/application/ports/repositories/place-repository.js';
import { AuthFixture } from '../../../fixtures/auth-fixture.js';
import { PlaceTypeFixture } from '../../../fixtures/place-type-fixture.js';
import { PlaceFixture } from '../../../fixtures/place-fixture.js';

describe('Feature: updating a place', () => {
  const tester = new Tester();
  let anthony: AuthFixture;
  let johnDoe: AuthFixture;
  let placeTypeFirst: PlaceTypeFixture;
  let placeTypeSecond: PlaceTypeFixture;
  let anthonyPlace: PlaceFixture;
  let johnPlace: PlaceFixture;

  let repository: IPlaceRepository;

  beforeAll(() => tester.beforeAll());

  beforeEach(async () => {
    anthony = authSeeds.anthony();
    johnDoe = authSeeds.johnDoe();
    placeTypeFirst = placeTypeSeeds.first();
    placeTypeSecond = placeTypeSeeds.second();
    anthonyPlace = placeSeeds.anthonyPlace();
    johnPlace = placeSeeds.johnDoePlace();

    await tester.beforeEach();
    await tester.clearDatabase();
    await tester.initialize([
      anthony,
      johnDoe,
      placeTypeFirst,
      placeTypeSecond,
      anthonyPlace,
      johnPlace,
    ]);

    repository = tester.get<IPlaceRepository>(I_PLACE_REPOSITORY);
  });

  afterEach(() => tester.afterEach());
  afterAll(() => tester.afterAll());

  describe('Scenario: updating a place', () => {
    it('should update the place', async () => {
      const placeId = johnPlace.id();
      const placeTypeId = placeTypeFirst.id();

      await request(tester.getHttpServer())
        .post('/places/update-place')
        .set('Authorization', johnDoe.authorize())
        .send({
          id: placeId,
          placeTypeId: placeTypeId,
          title: 'A new place',
          text: 'This is a place with the minimum amount of text required',
          location: {
            latitude: 10.0001,
            longitude: 20.0001,
          },
          private: false,
          images: [
            {
              id: '1',
              url: 'https://website.com/some-image.jpg',
            },
          ],
        })
        .expect(200);

      const query = await repository.byId(placeId);
      expect(query.isPresent()).toBe(true);

      const place = query.getOrThrow();
      expect(place).toMatchObject({
        title: 'A new place',
        text: 'This is a place with the minimum amount of text required',
        latitude: 10.0001,
        longitude: 20.0001,
        private: false,
        images: [
          {
            id: '1',
            url: 'https://website.com/some-image.jpg',
          },
        ],
      });

      expect(place.placeType.id).toBe(placeTypeId);
    });
  });

  describe('ScenarioGroup: Authorization', () => {
    describe('Scenario: updating someone else place', () => {
      it('should be forbidden', async () => {
        const placeId = anthonyPlace.id();
        const placeTypeId = placeTypeFirst.id();

        await request(tester.getHttpServer())
          .post('/places/update-place')
          .set('Authorization', johnDoe.authorize())
          .send({
            id: placeId,
            placeTypeId: placeTypeId,
            title: 'A new place',
            text: 'This is a place with the minimum amount of text required',
            location: {
              latitude: 10.0001,
              longitude: 20.0001,
            },
            private: false,
            images: [
              {
                id: '1',
                url: 'https://website.com/some-image.jpg',
              },
            ],
          })
          .expect(403);

        const query = await repository.byId(placeId);
        const place = query.getOrThrow();

        expect(place.title).toBe(anthonyPlace.raw().title);
      });
    });

    describe('Scenario: updating someone else place as an admin', () => {
      it('should be authorized', async () => {
        const placeId = johnPlace.id();
        const placeTypeId = placeTypeFirst.id();

        await request(tester.getHttpServer())
          .post('/places/update-place')
          .set('Authorization', anthony.authorize())
          .send({
            id: placeId,
            placeTypeId: placeTypeId,
            title: 'A new place',
            text: 'This is a place with the minimum amount of text required',
            location: {
              latitude: 10.0001,
              longitude: 20.0001,
            },
            private: false,
            images: [
              {
                id: '1',
                url: 'https://website.com/some-image.jpg',
              },
            ],
          })
          .expect(200);

        const query = await repository.byId(placeId);
        const place = query.getOrThrow();

        expect(place.title).toBe('A new place');
      });
    });
  });
});
