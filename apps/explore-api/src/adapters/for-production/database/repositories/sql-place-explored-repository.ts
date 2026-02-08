import { PlaceExplored } from '../../../../app/domain/entities/place-explored.js';
import { IPlaceExploredRepository } from '../../../../app/application/ports/repositories/place-explored-repository.js';
import { Optional } from '../../../../app/libs/shared/optional.js';
import { BaseSqlRepository } from '../base-sql-repository.js';

export class SqlPlaceExploredRepository
  extends BaseSqlRepository<PlaceExplored>
  implements IPlaceExploredRepository
{
  async byUserAndPlace(
    userId: string,
    placeId: string,
  ): Promise<Optional<PlaceExplored>> {
    const entity = await this.repository.findOne({
      user: userId,
      place: placeId,
    });

    return entity ? Optional.of(entity) : Optional.of<PlaceExplored>(null);
  }
}
