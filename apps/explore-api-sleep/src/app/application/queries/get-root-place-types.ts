import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EntityManager } from '@mikro-orm/postgresql';
import { BaseCommand } from '../../libs/shared/command.js';
import { ApiPlaceType } from '../viewmodels/api-place-type.js';
import { PlaceType } from '../../domain/entities/place-type.js';

export class GetRootPlaceTypesQuery extends BaseCommand {}

@QueryHandler(GetRootPlaceTypesQuery)
export class GetRootPlaceTypesQueryHandler
  implements IQueryHandler<GetRootPlaceTypesQuery, ApiPlaceType[]>
{
  constructor(private readonly em: EntityManager) {}

  async execute(): Promise<ApiPlaceType[]> {
    const placeTypes = await this.em
      .createQueryBuilder(PlaceType)
      .where({ parent: null, hidden: false })
      .orderBy({ order: 'ASC' })
      .getResultList();

    return placeTypes as unknown as ApiPlaceType[];
  }
}
