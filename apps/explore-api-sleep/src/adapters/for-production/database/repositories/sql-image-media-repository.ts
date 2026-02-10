import { IImageMediaRepository } from '../../../../app/application/ports/repositories/image-media-repository.js';
import { ImageMedia } from '../../../../app/domain/entities/image-media.js';
import { BaseSqlRepository } from '../base-sql-repository.js';

export class SqlImageMediaRepository
  extends BaseSqlRepository<ImageMedia>
  implements IImageMediaRepository {}
