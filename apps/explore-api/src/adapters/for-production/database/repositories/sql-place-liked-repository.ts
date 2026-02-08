import { PlaceLiked } from '../../../../app/domain/entities/place-liked.js';
import { IPlaceLikedRepository } from '../../../../app/application/ports/repositories/place-liked-repository.js';
import { Optional } from '../../../../app/libs/shared/optional.js';
import { BaseSqlRepository } from '../base-sql-repository.js';

export class SqlPlaceLikedRepository
  extends BaseSqlRepository<PlaceLiked>
  implements IPlaceLikedRepository
{
  async byUserAndPlace(userId: string, placeId: string) {
    const entity = await this.repository.findOne({
      user: userId,
      place: placeId,
    });

    return entity ? Optional.of(entity) : Optional.of<PlaceLiked>(null);
  }
}
