import path from 'path';

import { AuthFixture } from '../../../fixtures/auth-fixture.js';
import { UserBuilder } from '../../../../src/app/domain/builders/user-builder.js';
import {
  I_IMAGE_MEDIA_REPOSITORY,
  IImageMediaRepository,
} from '../../../../src/app/application/ports/repositories/image-media-repository.js';
import { Tester } from '../../../config/tester.js';
import request from 'supertest';

describe('Feature: Storing and compressing an Image Media', () => {
  let john: AuthFixture;

  const app: Tester = new Tester();
  let imageMediaRepository: IImageMediaRepository;

  beforeAll(async () => {
    await app.beforeAll();
  });

  beforeEach(async () => {
    john = new AuthFixture(new UserBuilder().id('john-doe').build());

    await app.beforeEach();
    await app.initialize([john]);

    imageMediaRepository = app.get<IImageMediaRepository>(
      I_IMAGE_MEDIA_REPOSITORY,
    );
  });

  afterAll(async () => {
    await app.afterAll();
  });

  describe('Scenario: happy path', () => {
    it('should upload the image and create thumbnails', async () => {
      const fixturesPath = path.resolve(__dirname, '../../../fixtures');
      const imagePath = path.resolve(fixturesPath, 'square_image.png');

      const result = await request(app.getHttpServer())
        .post('/medias/store-as-media')
        .set('Authorization', john.authorize())
        .attach('image', imagePath, 'square_image.png');

      expect(result.status).toBe(201);
    });
  });
});
