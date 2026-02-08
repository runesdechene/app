import { PlaceType } from '../../../../app/domain/entities/place-type.js';
import { IPlaceTypeRepository } from '../../../../app/application/ports/repositories/place-type-repository.js';
import { BaseSqlRepository } from '../base-sql-repository.js';

export class SqlPlaceTypeRepository
  extends BaseSqlRepository<PlaceType>
  implements IPlaceTypeRepository {}
