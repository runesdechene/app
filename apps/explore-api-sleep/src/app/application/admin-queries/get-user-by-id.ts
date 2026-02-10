import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import z from 'zod';
import { EntityManager } from '@mikro-orm/postgresql';

import { BaseCommand } from '../../libs/shared/command.js';
import { ApiAdminUser } from '../viewmodels/api-admin-user.js';
import { MikroApiAdminUserConverter } from '../admin-services/mikro-api-admin-user-converter.service.js';
import { User } from '../../domain/entities/user.js';
import { NotFoundException } from '../../libs/exceptions/not-found-exception.js';

export class GetUserByIdQuery extends BaseCommand<{ id: string }> {
  validate(props) {
    return z
      .object({
        id: z.string(),
      })
      .parse(props);
  }
}

/**
 * @deprecated not used
 */
@QueryHandler(GetUserByIdQuery)
export class GetUserByIdQueryHandler
  implements IQueryHandler<GetUserByIdQuery, ApiAdminUser>
{
  constructor(
    private readonly entityManager: EntityManager,
    private readonly userConverter: MikroApiAdminUserConverter,
  ) {}

  async execute(command: GetUserByIdQuery): Promise<ApiAdminUser> {
    const props = command.props();
    const user = await this.entityManager
      .createQueryBuilder(User)
      .where({ id: props.id })
      .getSingleResult();

    if (!user) {
      throw new NotFoundException();
    }

    return this.userConverter.convert(user);
  }
}
