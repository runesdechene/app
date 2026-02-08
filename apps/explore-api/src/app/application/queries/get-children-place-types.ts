import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EntityManager } from '@mikro-orm/postgresql';
import { BaseCommand } from '../../libs/shared/command.js';
import { ApiPlaceType } from '../viewmodels/api-place-type.js';
import z from 'zod';
import { PlaceType } from '../../domain/entities/place-type.js';

type Payload = {
  parentId: string;
};

export class GetChildrenPlaceTypesQuery extends BaseCommand<Payload> {
  validate(props: Payload): Payload {
    return z
      .object({
        parentId: z.string(),
      })
      .parse(props);
  }
}

@QueryHandler(GetChildrenPlaceTypesQuery)
export class GetChildrenPlaceTypesQueryHandler
  implements IQueryHandler<GetChildrenPlaceTypesQuery, ApiPlaceType[]>
{
  constructor(private readonly em: EntityManager) {}

  async execute(query: GetChildrenPlaceTypesQuery): Promise<ApiPlaceType[]> {
    const props = query.props();

    const placeTypes = await this.em
      .createQueryBuilder(PlaceType)
      .where({ parent: props.parentId, hidden: false })
      .orWhere({ id: props.parentId, hidden: false })
      // Make sure that root appears first
      .orderBy([{ parent: 'DESC' }, { order: 'ASC' }])
      .getResultList();

    return placeTypes as unknown as ApiPlaceType[];
  }
}
