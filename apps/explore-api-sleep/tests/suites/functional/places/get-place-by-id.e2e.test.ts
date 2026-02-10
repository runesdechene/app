import request from 'supertest';
import { Tester } from '../../../config/tester.js';
import { authSeeds } from '../../../seeds/user-seeds.js';
import { placeTypeSeeds } from '../../../seeds/place-type-seeds.js';
import { placeSeeds } from '../../../seeds/place-seeds.js';
import { AuthFixture } from '../../../fixtures/auth-fixture.js';
import { PlaceFixture } from '../../../fixtures/place-fixture.js';

describe('Feature: get place by id', () => {
  const tester = new Tester();
  let anthony: AuthFixture;
  let johnDoe: AuthFixture;
  let johnDoe1: AuthFixture;
  let johnDoe2: AuthFixture;
  let johnDoe3: AuthFixture;
  let johnDoe4: AuthFixture;
  let place: PlaceFixture;

  beforeAll(async () => {
    anthony = authSeeds.anthony();
    johnDoe = authSeeds.johnDoe();
    johnDoe1 = authSeeds.johnDoe1();
    johnDoe2 = authSeeds.johnDoe2();
    johnDoe3 = authSeeds.johnDoe3();
    johnDoe4 = authSeeds.johnDoe4();
    place = placeSeeds.first();

    await tester.beforeAll();
    await tester.initialize([
      anthony,
      johnDoe,
      johnDoe1,
      johnDoe2,
      johnDoe3,
      johnDoe4,
      placeTypeSeeds.first(),
      placeTypeSeeds.second(),
      place,
      placeSeeds.second(),
    ]);
  });

  beforeEach(async () => {
    await tester.beforeEach();
  });

  afterEach(() => tester.afterEach());
  afterAll(() => tester.afterAll());

  it('Scenario: when authenticated', async () => {
    const placeAuthor = anthony.raw();

    const result = await request(tester.getHttpServer())
      .get('/places/get-place-by-id?id=' + place.id())
      .set('Authorization', johnDoe.authorize())
      .expect(200);
    const refacto = result.body;
    delete refacto.type.images;
    delete refacto.type.updatedAt;
    delete refacto.type.createdAt;

    expect(refacto).toEqual({
      id: 'place-1',
      title: 'Mont Saint Michel',
      text: 'This is the first place',
      address: '1st Street',
      accessibility: 'medium',
      sensible: false,
      geocaching: false,
      images: [],
      author: {
        id: placeAuthor.id,
        lastName: placeAuthor.lastName,
        profileImageUrl: null,
      },
      beginAt: null,
      endAt: null,
      type: {
        id: 'place-type-1',
        title: 'Place Type 1',
        color: '#000000',
        background: '#000000',
        border: '#000000',
        fadedColor: '#000000',
        parent: null,
        order: 1,
        longDescription: 'This is the first place type',
        formDescription: 'This is the first place type',
        hidden: false,
      },
      location: { latitude: 48.64002, longitude: -1.51228 },
      metrics: { views: 0, likes: 0, explored: 0 },
      requester: { bookmarked: false, liked: false, explored: false },
      lastExplorers: [],
    });
  });

  it('Scenario: when authenticated with explorers', async () => {
    const placeAuthor = anthony.raw();
    const JD1 = johnDoe1.raw();
    const JD2 = johnDoe2.raw();
    const JD3 = johnDoe3.raw();
    const JD4 = johnDoe4.raw();
    await request(tester.getHttpServer())
      .post('/places/explore-place')
      .set('Authorization', johnDoe1.authorize())
      .send({
        id: place.id(),
      })
      .expect(200);
    await request(tester.getHttpServer())
      .post('/places/explore-place')
      .set('Authorization', johnDoe2.authorize())
      .send({
        id: place.id(),
      })
      .expect(200);
    await request(tester.getHttpServer())
      .post('/places/explore-place')
      .set('Authorization', anthony.authorize())
      .send({
        id: place.id(),
      })
      .expect(200);
    await request(tester.getHttpServer())
      .post('/places/explore-place')
      .set('Authorization', johnDoe3.authorize())
      .send({
        id: place.id(),
      })
      .expect(200);
    await request(tester.getHttpServer())
      .post('/places/explore-place')
      .set('Authorization', johnDoe4.authorize())
      .send({
        id: place.id(),
      })
      .expect(200);

    const result = await request(tester.getHttpServer())
      .get('/places/get-place-by-id?id=' + place.id())
      .set('Authorization', johnDoe.authorize())
      .expect(200);
    const refacto = result.body;
    delete refacto.type.images;
    delete refacto.type.updatedAt;
    delete refacto.type.createdAt;

    expect(refacto).toEqual({
      id: 'place-1',
      title: 'Mont Saint Michel',
      text: 'This is the first place',
      address: '1st Street',
      accessibility: 'medium',
      sensible: false,
      geocaching: false,
      images: [],
      author: {
        id: placeAuthor.id,
        lastName: placeAuthor.lastName,
        profileImageUrl: null,
      },
      type: {
        id: 'place-type-1',
        title: 'Place Type 1',
        color: '#000000',
        background: '#000000',
        border: '#000000',
        fadedColor: '#000000',
        parent: null,
        order: 1,
        longDescription: 'This is the first place type',
        formDescription: 'This is the first place type',
        hidden: false,
      },
      beginAt: null,
      endAt: null,
      location: { latitude: 48.64002, longitude: -1.51228 },
      metrics: { views: 0, likes: 0, explored: 5 },
      requester: { bookmarked: false, liked: false, explored: false },
      lastExplorers: [
        {
          id: JD4.id,
          lastName: JD4.lastName,
          profileImageUrl: null,
        },
        {
          id: JD3.id,
          lastName: JD3.lastName,
          profileImageUrl: null,
        },
        {
          id: JD2.id,
          lastName: JD2.lastName,
          profileImageUrl: null,
        },
        {
          id: JD1.id,
          lastName: JD1.lastName,
          profileImageUrl: null,
        },
      ],
    });
  });

  it('Scenario: when not authenticated, requester should be null', async () => {
    const result = await request(tester.getHttpServer())
      .get('/places/get-place-by-id?id=' + place.id())
      .expect(200);

    expect(result.body.requester).toBe(null);
  });
});
