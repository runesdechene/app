import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EntityManager } from '@mikro-orm/postgresql';
import z from 'zod';

import {
  PaginatedQuery,
  PaginatedResult,
} from '../../libs/shared/pagination.js';
import { ApiPlaceSummary } from '../viewmodels/api-place-summary.js';
import { BaseCommand } from '../../libs/shared/command.js';
import { Place } from '../../domain/entities/place.js';
import { PlaceSummaryHelper } from '../../libs/places/place-summary-helper.js';

type Payload = PaginatedQuery<
  | {
      type: 'all';
    }
  | {
      type: 'latest';
    }
>;

export class GetBannerFeedQuery extends BaseCommand<Payload> {
  validate(props: Payload): Payload {
    return z
      .object({
        params: z
          .union([
            z.object({
              type: z.literal('all'),
            }),
            z.object({
              type: z.literal('latest'),
            }),
          ])
          .optional(),
        page: z.number().optional(),
        count: z.number().max(100).min(1).optional(),
      })
      .parse(props) as unknown as Payload;
  }
}

@QueryHandler(GetBannerFeedQuery)
export class GetBannerFeedQueryHandler
  implements IQueryHandler<GetBannerFeedQuery, PaginatedResult<ApiPlaceSummary>>
{
  private placeSummaryHelper: PlaceSummaryHelper;

  constructor(private readonly em: EntityManager) {
    this.placeSummaryHelper = new PlaceSummaryHelper(em);
  }

  async execute(
    query: GetBannerFeedQuery,
  ): Promise<PaginatedResult<ApiPlaceSummary>> {
    const props = query.props();
    const page = props.page ?? 1;
    const count = props.count ?? 10;
    const start = page * count - count;

    let result: any[] = [];
    const total = await this.em.count(Place, {});

    if (props.params?.type === 'all') {
      result = await this.em.execute(
        `
            SELECT ROW_TO_JSON(p)  AS place_data,
                   ROW_TO_JSON(pt) AS place_type,
                   COUNT(pv.id)    AS views_count,
                   AVG(r.score) as avg_score
            FROM places as p
                     LEFT JOIN places_viewed AS pv ON pv.place_id = p.id
                     LEFT JOIN place_types AS pt ON pt.id = p.place_type_id
                     LEFT JOIN reviews AS r ON p.id = r.place_id
            WHERE pt.hidden IS true
            GROUP BY p.id, pt.id
            ORDER BY views_count DESC
            LIMIT ? OFFSET ?;
        `,
        [count, start],
      );
    } else {
      result = await this.em.execute(
        `
            SELECT ROW_TO_JSON(p)  AS place_data,
                   ROW_TO_JSON(pt) AS place_type,
                   AVG(r.score) as avg_score
            FROM places as p
                     LEFT JOIN place_types AS pt ON pt.id = p.place_type_id
                     LEFT JOIN reviews AS r ON p.id = r.place_id
            WHERE pt.hidden IS true
            AND CURRENT_DATE >= p.begin_at - INTERVAL'7 day'
            AND CURRENT_DATE <= p.end_at
            GROUP BY p.id, pt.id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?;
        `,
        [count, start],
      );
    }

    return {
      data: await Promise.all(
        result.map((result) =>
          this.placeSummaryHelper.map(result, query.auth(), true),
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
