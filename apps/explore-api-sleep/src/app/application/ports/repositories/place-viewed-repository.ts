import { Optional } from '../../../libs/shared/optional.js';
import { PlaceViewed } from '../../../domain/entities/place-viewed.js';

export const I_PLACE_VIEWED_REPOSITORY = Symbol('I_PLACE_VIEWED_REPOSITORY');

export interface IPlaceViewedRepository {
  byId(id: string): Promise<Optional<PlaceViewed>>;

  byUserAndPlace(
    userId: string,
    placeId: string,
  ): Promise<Optional<PlaceViewed>>;

  save(entity: PlaceViewed): Promise<void>;

  delete(entity: PlaceViewed): Promise<void>;

  clear(): Promise<void>;
}
