import {
  I_IMAGE_MEDIA_REPOSITORY,
  IImageMediaRepository,
} from '../../src/app/application/ports/repositories/image-media-repository.js';
import { ITester } from '../config/tester.interface.js';
import { IFixture } from '../config/fixture.interface.js';
import { ImageMedia } from '../../src/app/domain/entities/image-media.js';

export class ImageMediaFixture implements IFixture {
  constructor(private readonly imageMedia: ImageMedia) {}

  async load(app: ITester) {
    await app
      .get<IImageMediaRepository>(I_IMAGE_MEDIA_REPOSITORY)
      .save(this.imageMedia);
  }
}
