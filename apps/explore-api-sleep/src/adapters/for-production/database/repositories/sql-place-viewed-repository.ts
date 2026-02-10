import { PlaceViewed } from '../../../../app/domain/entities/place-viewed.js';
import { IPlaceViewedRepository } from '../../../../app/application/ports/repositories/place-viewed-repository.js';
import { Optional } from '../../../../app/libs/shared/optional.js';
import { BaseSqlRepository } from '../base-sql-repository.js';

export class SqlPlaceViewedRepository
  extends BaseSqlRepository<PlaceViewed>
  implements IPlaceViewedRepository
{
  async byUserAndPlace(
    userId: string,
    placeId: string,
  ): Promise<Optional<PlaceViewed>> {
    const entity = await this.repository.findOne({
      user: userId,
      place: placeId,
    });

    return entity ? Optional.of(entity) : Optional.of<PlaceViewed>(null);
  }
}
