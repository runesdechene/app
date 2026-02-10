import { Place } from '../../../../app/domain/entities/place.js';
import { IPlaceRepository } from '../../../../app/application/ports/repositories/place-repository.js';
import { BaseSqlRepository } from '../base-sql-repository.js';

export class SqlPlaceRepository
  extends BaseSqlRepository<Place>
  implements IPlaceRepository {}
