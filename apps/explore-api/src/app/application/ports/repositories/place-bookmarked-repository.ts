import { Optional } from '../../../libs/shared/optional.js';
import { PlaceBookmarked } from '../../../domain/entities/place-bookmarked.js';

export const I_PLACE_BOOKMARKED_REPOSITORY = Symbol(
  'I_PLACE_BOOKMARKED_REPOSITORY',
);

export interface IPlaceBookmarkedRepository {
  byId(id: string): Promise<Optional<PlaceBookmarked>>;

  byUserAndPlace(
    userId: string,
    placeId: string,
  ): Promise<Optional<PlaceBookmarked>>;

  save(entity: PlaceBookmarked): Promise<void>;

  delete(entity: PlaceBookmarked): Promise<void>;

  clear(): Promise<void>;
}
