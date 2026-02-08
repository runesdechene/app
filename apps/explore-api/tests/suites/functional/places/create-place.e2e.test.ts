import request from 'supertest';
import { Tester } from '../../../config/tester.js';
import { authSeeds } from '../../../seeds/user-seeds.js';
import { placeTypeSeeds } from '../../../seeds/place-type-seeds.js';
import {
  I_PLACE_REPOSITORY,
  IPlaceRepository,
} from '../../../../src/app/application/ports/repositories/place-repository.js';
import { AuthFixture } from '../../../fixtures/auth-fixture.js';
import { PlaceTypeFixture } from '../../../fixtures/place-type-fixture.js';

describe('Feature: creating a place', () => {
  const tester = new Tester();
  let repository: IPlaceRepository;
  let john: AuthFixture;
  let placeType: PlaceTypeFixture;

  beforeEach(() => tester.beforeEach());

  beforeAll(async () => {
    john = authSeeds.johnDoe();
    placeType = placeTypeSeeds.first();

    await tester.beforeAll();
    await tester.initialize([john, placeType]);

    repository = tester.get<IPlaceRepository>(I_PLACE_REPOSITORY);
  });

  afterEach(() => tester.afterEach());
  afterAll(() => tester.afterAll());

  it('Scenario: creating a place', async () => {
    const result = await request(tester.getHttpServer())
      .post('/places/create-place')
      .set('Authorization', john.authorize())
      .send({
        placeTypeId: placeType.id(),
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
        accessibility: 'hard',
        bivouac: 'test bivouac',
      });

    expect(result.status).toBe(200);

    const id = result.body.id;

    const query = await repository.byId(id);
    expect(query.isPresent()).toBe(true);

    const place = query.getOrThrow();
    expect(place).toMatchObject({
      title: 'A new place',
      text: 'This is a place with the minimum amount of text required',
      latitude: 10.0001,
      longitude: 20.0001,
      private: false,
      accessibility: 'hard',
      sensible: false,
      images: [
        {
          id: '1',
          url: 'https://website.com/some-image.jpg',
        },
      ],
    });

    expect(place.placeType.id).toBe(placeType.id());
  });

  it('Scenario: creating a place with sensible', async () => {
    const result = await request(tester.getHttpServer())
      .post('/places/create-place')
      .set('Authorization', john.authorize())
      .send({
        placeTypeId: placeType.id(),
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
        accessibility: 'hard',
        sensible: true,
        bivouac: 'test bivouac',
      });

    expect(result.status).toBe(200);

    const id = result.body.id;

    const query = await repository.byId(id);
    expect(query.isPresent()).toBe(true);

    const place = query.getOrThrow();
    expect(place).toMatchObject({
      title: 'A new place',
      text: 'This is a place with the minimum amount of text required',
      latitude: 10.0001,
      longitude: 20.0001,
      private: false,
      accessibility: 'hard',
      sensible: true,
      images: [
        {
          id: '1',
          url: 'https://website.com/some-image.jpg',
        },
      ],
    });

    expect(place.placeType.id).toBe(placeType.id());
  });
});
