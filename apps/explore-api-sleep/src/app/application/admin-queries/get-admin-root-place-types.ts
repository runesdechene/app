import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EntityManager } from '@mikro-orm/postgresql';
import { BaseCommand } from '../../libs/shared/command.js';
import { ApiPlaceType } from '../viewmodels/api-place-type.js';
import { PlaceType } from '../../domain/entities/place-type.js';

export class GetAdminRootPlaceTypesQuery extends BaseCommand {}

@QueryHandler(GetAdminRootPlaceTypesQuery)
export class GetAdminRootPlaceTypesQueryHandler
  implements IQueryHandler<GetAdminRootPlaceTypesQuery, ApiPlaceType[]>
{
  constructor(private readonly em: EntityManager) {}

  async execute(): Promise<ApiPlaceType[]> {
    const placeTypes = await this.em
      .createQueryBuilder(PlaceType)
      .where({ parent: null, hidden: true })
      .orderBy({ order: 'ASC' })
      .getResultList();

    return placeTypes as unknown as ApiPlaceType[];
  }
}
