import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import z from 'zod';
import { EntityManager } from '@mikro-orm/postgresql';

import { BaseCommand } from '../../libs/shared/command.js';
import {
  PaginatedQuery,
  PaginatedResult,
} from '../../libs/shared/pagination.js';
import { ApiAdminUser } from '../viewmodels/api-admin-user.js';
import { MikroApiAdminUserConverter } from '../admin-services/mikro-api-admin-user-converter.service.js';
import { User } from '../../domain/entities/user.js';

export class GetAllUsersQuery extends BaseCommand<PaginatedQuery<{}>> {
  validate(props) {
    return z
      .object({
        params: z.any(),
        page: z.number().optional(),
        count: z.number().max(100).min(1).optional(),
      })
      .parse(props);
  }
}
/**
 * @deprecated not used
 */
@QueryHandler(GetAllUsersQuery)
export class GetAllUsersQueryHandler
  implements IQueryHandler<GetAllUsersQuery, PaginatedResult<ApiAdminUser>>
{
  constructor(
    private readonly entityManager: EntityManager,
    private readonly userConverter: MikroApiAdminUserConverter,
  ) {}

  async execute(
    command: GetAllUsersQuery,
  ): Promise<PaginatedResult<ApiAdminUser>> {
    const props = command.props();
    const page = props.page ?? 1;
    const count = props.count ?? 10;
    const start = page * count - count;

    const result = await this.entityManager
      .createQueryBuilder(User)
      .limit(count)
      .offset(start)
      .orderBy({ createdAt: 'ASC' })
      .getResultList();

    const total = await this.entityManager.count(User);

    return {
      data: await Promise.all(
        result.map(
          async (result): Promise<ApiAdminUser> =>
            this.userConverter.convert(result),
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
