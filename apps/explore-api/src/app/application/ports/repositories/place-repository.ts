import { Optional } from '../../../libs/shared/optional.js';
import { Place } from '../../../domain/entities/place.js';

export const I_PLACE_REPOSITORY = Symbol('I_PLACE_REPOSITORY');

export interface IPlaceRepository {
  byId(id: string): Promise<Optional<Place>>;

  save(entity: Place): Promise<void>;

  delete(entity: Place): Promise<void>;

  clear(): Promise<void>;
}
