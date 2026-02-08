import { EntityManager } from '@mikro-orm/postgresql';

import { PaginatedResult } from '../shared/pagination.js';
import { ApiPlaceSummary } from '../../application/viewmodels/api-place-summary.js';
import { PlaceSummaryHelper } from './place-summary-helper.js';
import { BaseCommand } from '../shared/command.js';

export abstract class GetPlacesBase {
  private readonly placeSummaryHelper: PlaceSummaryHelper;

  abstract tableName: string;

  constructor(private readonly em: EntityManager) {
    this.placeSummaryHelper = new PlaceSummaryHelper(em);
  }

  async getPlaces(
    query: BaseCommand<{
      params?: { userId: string };
      page?: number;
      count?: number;
    }>,
  ): Promise<PaginatedResult<ApiPlaceSummary>> {
    const props = query.props();
    const page = props.page ?? 1;
    const count = props.count ?? 10;
    const start = page * count - count;

    const result = await this.placeSummaryHelper.makeQuery({
      content: `WHERE p.id IN (SELECT place_id FROM ${this.tableName} WHERE user_id = ? AND pt.hidden IS false)`,
      count,
      start,
      args: [props.params!.userId],
    });

    const totalQuery = await this.em.execute(
      `
    SELECT COUNT(p.*) as total FROM places AS p LEFT JOIN place_types AS pt ON pt.id = p.place_type_id WHERE p.id IN (SELECT place_id FROM ${this.tableName} WHERE user_id = ?) AND pt.hidden IS false
`,
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
