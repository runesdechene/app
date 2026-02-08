import { Optional } from '../../../libs/shared/optional.js';
import { PlaceLiked } from '../../../domain/entities/place-liked.js';

export const I_PLACE_LIKED_REPOSITORY = Symbol('I_PLACE_LIKED_REPOSITORY');

export interface IPlaceLikedRepository {
  byId(id: string): Promise<Optional<PlaceLiked>>;

  byUserAndPlace(
    userId: string,
    placeId: string,
  ): Promise<Optional<PlaceLiked>>;

  save(entity: PlaceLiked): Promise<void>;

  delete(entity: PlaceLiked): Promise<void>;

  clear(): Promise<void>;
}
