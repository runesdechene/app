import { Optional } from '../../../libs/shared/optional.js';
import { PlaceExplored } from '../../../domain/entities/place-explored.js';

export const I_PLACE_EXPLORED_REPOSITORY = Symbol(
  'I_PLACE_EXPLORED_REPOSITORY',
);

export interface IPlaceExploredRepository {
  byId(id: string): Promise<Optional<PlaceExplored>>;

  byUserAndPlace(
    userId: string,
    placeId: string,
  ): Promise<Optional<PlaceExplored>>;

  save(entity: PlaceExplored): Promise<void>;

  delete(entity: PlaceExplored): Promise<void>;

  clear(): Promise<void>;
}
