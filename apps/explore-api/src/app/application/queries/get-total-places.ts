import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EntityManager } from '@mikro-orm/postgresql';
import { BaseCommand } from '../../libs/shared/command.js';
import { ApiTotalPlaces } from '../viewmodels/api-total-places.js';
import { Place } from '../../domain/entities/place.js';

export class GetTotalPlacesQuery extends BaseCommand {}

@QueryHandler(GetTotalPlacesQuery)
export class GetTotalPlacesQueryHandler
  implements IQueryHandler<GetTotalPlacesQuery, ApiTotalPlaces>
{
  constructor(private readonly em: EntityManager) {}

  async execute(): Promise<ApiTotalPlaces> {
    const totalQuery = await this.em.createQueryBuilder(Place, 'p').count();

    return { count: totalQuery };
  }
}
