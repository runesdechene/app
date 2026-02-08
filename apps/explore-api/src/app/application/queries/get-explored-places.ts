import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EntityManager } from '@mikro-orm/postgresql';
import z from 'zod';

import {
  PaginatedQuery,
  PaginatedResult,
} from '../../libs/shared/pagination.js';
import { ApiPlaceSummary } from '../viewmodels/api-place-summary.js';
import { BaseCommand } from '../../libs/shared/command.js';
import { GetPlacesBase } from '../../libs/places/get-places-base.js';

export class GetExploredPlacesQuery extends BaseCommand<
  PaginatedQuery<{ userId: string }>
> {
  validate(props) {
    return z
      .object({
        params: z.object({
          userId: z.string(),
        }),
        page: z.number().optional(),
        count: z.number().max(100).min(1).optional(),
      })
      .parse(props);
  }
}

@QueryHandler(GetExploredPlacesQuery)
export class GetExploredPlacesQueryHandler
  extends GetPlacesBase
  implements
    IQueryHandler<GetExploredPlacesQuery, PaginatedResult<ApiPlaceSummary>>
{
  tableName = 'places_explored';

  constructor(em: EntityManager) {
    super(em);
  }

  async execute(
    query: GetExploredPlacesQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>> {
    return this.getPlaces(query);
  }
}
