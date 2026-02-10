import { Optional } from '../../../libs/shared/optional.js';
import { PlaceType } from '../../../domain/entities/place-type.js';

export const I_PLACE_TYPE_REPOSITORY = Symbol('I_PLACE_TYPE_REPOSITORY');

export interface IPlaceTypeRepository {
  byId(id: string): Promise<Optional<PlaceType>>;

  save(entity: PlaceType): Promise<void>;

  delete(entity: PlaceType): Promise<void>;

  clear(): Promise<void>;
}
