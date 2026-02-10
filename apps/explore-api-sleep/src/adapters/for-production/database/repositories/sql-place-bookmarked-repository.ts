import { PlaceBookmarked } from '../../../../app/domain/entities/place-bookmarked.js';
import { IPlaceBookmarkedRepository } from '../../../../app/application/ports/repositories/place-bookmarked-repository.js';
import { Optional } from '../../../../app/libs/shared/optional.js';
import { BaseSqlRepository } from '../base-sql-repository.js';

export class SqlPlaceBookmarkedRepository
  extends BaseSqlRepository<PlaceBookmarked>
  implements IPlaceBookmarkedRepository
{
  async byUserAndPlace(
    userId: string,
    placeId: string,
  ): Promise<Optional<PlaceBookmarked>> {
    const entity = await this.repository.findOne({
      user: userId,
      place: placeId,
    });

    return entity ? Optional.of(entity) : Optional.of<PlaceBookmarked>(null);
  }
}
