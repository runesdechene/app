import { IImageMediaRepository } from '../../../../app/application/ports/repositories/image-media-repository.js';
import { BaseRamRepository } from '../base-ram-repository.js';
import { ImageMedia } from '../../../../app/domain/entities/image-media.js';

export class RamMediaRepository
  extends BaseRamRepository<ImageMedia>
  implements IImageMediaRepository {}
