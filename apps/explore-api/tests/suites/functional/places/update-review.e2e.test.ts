import request from 'supertest';
import { Tester } from '../../../config/tester.js';
import { authSeeds } from '../../../seeds/user-seeds.js';
import { placeTypeSeeds } from '../../../seeds/place-type-seeds.js';
import { placeSeeds } from '../../../seeds/place-seeds.js';
import { AuthFixture } from '../../../fixtures/auth-fixture.js';
import { PlaceFixture } from '../../../fixtures/place-fixture.js';
import {
  I_REVIEW_REPOSITORY,
  IReviewRepository,
} from '../../../../src/app/application/ports/repositories/review-repository.js';

describe('Feature: update review', () => {
  const tester = new Tester();
  let anthony: AuthFixture;
  let johnDoe: AuthFixture;
  let repository: IReviewRepository;
  let place: PlaceFixture;
  let reviewId: string;

  afterEach(() => tester.afterEach());
  afterAll(() => tester.afterAll());

  beforeAll(async () => {
    anthony = authSeeds.anthony();
    johnDoe = authSeeds.johnDoe();
    place = placeSeeds.first();

    await tester.beforeAll();
    await tester.initialize([
      anthony,
      johnDoe,
      placeTypeSeeds.first(),
      placeTypeSeeds.second(),
      place,
      placeSeeds.second(),
    ]);

    const creation = await request(tester.getHttpServer())
      .post('/reviews/create-review')
      .set('Authorization', johnDoe.authorize())
      .send({
        placeId: place.id(),
        imagesIds: [],
        score: 3,
        message: 'super lieux',
        geocache: true,
      });

    expect(creation.status).toBe(200);
    reviewId = creation.body.id;
  });

  beforeEach(async () => {
    await tester.beforeEach();
    repository = tester.get<IReviewRepository>(I_REVIEW_REPOSITORY);
  });

  afterEach(() => tester.afterEach());
  afterAll(() => tester.afterAll());

  it('Scenario: when authenticated without geocache', async () => {
    const result = await request(tester.getHttpServer())
      .post('/reviews/update-review')
      .set('Authorization', johnDoe.authorize())
      .send({
        reviewId: reviewId,
        placeId: place.id(),
        imagesIds: [],
        score: 5,
        message: 'j adore au top vraiment',
      });
    expect(result.status).toBe(200);
    const query = await repository.byId(reviewId);
    expect(query.isPresent()).toBe(true);

    const review: any = query.getOrThrow();
    delete review.id;
    delete review.updatedAt;
    delete review.createdAt;

    expect(JSON.parse(JSON.stringify(review))).toEqual({
      user: johnDoe.id(),
      place: place.id(),
      score: 5,
      message: 'j adore au top vraiment',
      geocache: false,
    });
  });

  it('Scenario: when authenticated', async () => {
    const result = await request(tester.getHttpServer())
      .post('/reviews/update-review')
      .set('Authorization', johnDoe.authorize())
      .send({
        reviewId: reviewId,
        placeId: place.id(),
        imagesIds: [],
        score: 5,
        message: 'j adore au top vraiment',
        geocache: false,
      });
    expect(result.status).toBe(200);
    const query = await repository.byId(reviewId);
    expect(query.isPresent()).toBe(true);

    const review: any = query.getOrThrow();
    delete review.id;
    delete review.updatedAt;
    delete review.createdAt;

    expect(JSON.parse(JSON.stringify(review))).toEqual({
      user: johnDoe.id(),
      place: place.id(),
      score: 5,
      message: 'j adore au top vraiment',
      geocache: false,
    });
  });

  it('Scenario: when not authenticated', async () => {
    const result = await request(tester.getHttpServer())
      .post('/reviews/update-review')
      .send({
        reviewId: reviewId,
        placeId: place.id(),
        imagesIds: [],
        score: 5,
        message: 'super lieux',
        geocache: true,
      });

    expect(result.status).toBe(403);
  });
});
