import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EntityManager } from '@mikro-orm/postgresql';
import z from 'zod';

import {
  PaginatedQuery,
  PaginatedResult,
} from '../../libs/shared/pagination.js';
import { ApiPlaceSummary } from '../viewmodels/api-place-summary.js';
import { BaseCommand } from '../../libs/shared/command.js';
import { PlaceSummaryHelper } from '../../libs/places/place-summary-helper.js';

export class GetAddedPlacesQuery extends BaseCommand<
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

@QueryHandler(GetAddedPlacesQuery)
export class GetAddedPlacesQueryHandler
  implements
    IQueryHandler<GetAddedPlacesQuery, PaginatedResult<ApiPlaceSummary>>
{
  private readonly placeSummaryHelper: PlaceSummaryHelper;

  constructor(private readonly em: EntityManager) {
    this.placeSummaryHelper = new PlaceSummaryHelper(em);
  }

  async execute(
    query: GetAddedPlacesQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>> {
    const props = query.props();
    const page = props.page ?? 1;
    const count = props.count ?? 10;
    const start = page * count - count;

    const result = await this.placeSummaryHelper.makeQuery({
      content: `WHERE p.author_id = ? AND pt.hidden IS false`,
      count,
      start,
      args: [props.params!.userId],
    });

    const totalQuery = await this.em.execute(
      `SELECT COUNT(p.*) as total
       FROM places AS p
       LEFT JOIN place_types AS pt ON pt.id = p.place_type_id
       WHERE p.author_id = ? AND pt.hidden IS false`,
      [props.params!.userId],
    );

    const total = parseInt(totalQuery[0].total, 10);

    return {
      data: await Promise.all(
        result.map(
          async (result): Promise<ApiPlaceSummary> =>
            this.placeSummaryHelper.map(result, query.auth()),
        ),
      ),
      meta: {
        page,
        count,
        total,
      },
    };
  }
}
