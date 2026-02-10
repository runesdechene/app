import { Optional } from '../../../libs/shared/optional.js';
import { ImageMedia } from '../../../domain/entities/image-media.js';

export const I_IMAGE_MEDIA_REPOSITORY = Symbol('I_IMAGE_MEDIA_REPOSITORY');

export interface IImageMediaRepository {
  byId(id: string): Promise<Optional<ImageMedia>>;

  save(imageMedia: ImageMedia): Promise<void>;

  delete(imageMedia: ImageMedia): Promise<void>;

  clear(): Promise<void>;
}
