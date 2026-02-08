import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EntityManager } from '@mikro-orm/postgresql';
import z from 'zod';
import { BaseCommand } from '../../libs/shared/command.js';
import { ApiUserProfile } from '../viewmodels/api-user-profile.js';
import { NotFoundException } from '../../libs/exceptions/not-found-exception.js';
import { User } from '../../domain/entities/user.js';
import { Place } from '../../domain/entities/place.js';
import { PlaceExplored } from '../../domain/entities/place-explored.js';

export class GetUserProfileQuery extends BaseCommand<{ id: string }> {
  validate(props) {
    return z
      .object({
        id: z.string(),
      })
      .parse(props);
  }
}

@QueryHandler(GetUserProfileQuery)
export class GetUserProfileQueryHandler
  implements IQueryHandler<GetUserProfileQuery, ApiUserProfile>
{
  constructor(private readonly em: EntityManager) {}

  async execute(query: GetUserProfileQuery): Promise<ApiUserProfile> {
    const id = query.props().id;
    const user = await this.em
      .createQueryBuilder(User)
      .leftJoinAndSelect('profileImageId', 'pi')
      .where({ id })
      .getSingleResult();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const placesAdded = await this.em.execute(
      `SELECT COUNT(p.*) as total
       FROM places AS p
       LEFT JOIN place_types AS pt ON pt.id = p.place_type_id
       WHERE p.author_id = ? AND pt.hidden IS false`,
      [user.id],
    );

    const placesExploredPromise = this.em
      .createQueryBuilder(PlaceExplored)
      .count()
      .where({ user: user.id });

    const data = await Promise.all([placesExploredPromise]);

    return {
      id: user.id,
      lastName: user.lastName,
      biography: user.biography,
      profileImageUrl: user.profileImageId
        ? (user.profileImageId.unwrap().findVariantMatching(['png_small'])
            ?.url ?? null)
        : null,
      instagramId: user.instagramId ?? null,
      websiteUrl: user.websiteUrl ?? null,
      metrics: {
        placesAdded: placesAdded?.[0].total ?? 0,
        placesExplored: data[0] ?? 0,
      },
    };
  }
}
