import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import z from 'zod';
import { EntityManager } from '@mikro-orm/postgresql';

import { BaseCommand } from '../../libs/shared/command.js';
import { ApiAdminStats } from '../viewmodels/api-admin-stats.js';

export class GetAdminStatsQuery extends BaseCommand<{}> {
  validate(props) {
    return z.object({}).parse(props);
  }
}

@QueryHandler(GetAdminStatsQuery)
export class GetAdminStatsQueryHandler
  implements IQueryHandler<GetAdminStatsQuery, ApiAdminStats>
{
  constructor(private readonly entityManager: EntityManager) {}

  async execute(): Promise<ApiAdminStats> {
    const totalUsersQuery = await this.entityManager.execute(
      `SELECT COUNT(*) as total from users`,
    );
    const totalUsers = parseInt(totalUsersQuery[0].total, 10);

    const totalUsersConnected30DaysQuery = await this.entityManager.execute(
      `SELECT COUNT(*) as total from users WHERE last_access >= (CURRENT_DATE - INTERVAL '30' day)`,
    );
    const totalUsersConnected30Days = parseInt(
      totalUsersConnected30DaysQuery[0].total,
      10,
    );

    const totalUsersSignInLast7DaysQuery = await this.entityManager.execute(
      `SELECT COUNT(*) as total from users WHERE created_at >= (CURRENT_DATE - INTERVAL '7' day)`,
    );
    const totalUsersSignInLast7Days = parseInt(
      totalUsersSignInLast7DaysQuery[0].total,
      10,
    );

    const repartitionDeviceQuery = await this.entityManager.execute(
      `SELECT last_device_os ,COUNT(*) as total from users GROUP BY last_device_os`,
    );

    let nbAndroid = 0;
    let nbApple = 0;
    let nbOthers = 0;
    repartitionDeviceQuery.forEach((row) => {
      if (row.last_device_os === 'android') {
        nbAndroid += parseInt(row.total, 10);
      } else if (row.last_device_os === 'apple') {
        nbApple += parseInt(row.total, 10);
      } else {
        nbOthers += parseInt(row.total, 10);
      }
    });

    const totalPlacesAdded30DaysQuery = await this.entityManager.execute(
      `SELECT COUNT(*) as total from places WHERE created_at >= (CURRENT_DATE - INTERVAL '30' day)`,
    );
    const totalPlacesAdded30Days = parseInt(
      totalPlacesAdded30DaysQuery[0].total,
      10,
    );

    const totalPlacesAddedQuery = await this.entityManager.execute(
      `SELECT COUNT(*) as total from places`,
    );
    const totalPlacesAdded = parseInt(totalPlacesAddedQuery[0].total, 10);

    const totalReviewsAdded30DaysQuery = await this.entityManager.execute(
      `SELECT COUNT(*) as total from reviews WHERE created_at >= (CURRENT_DATE - INTERVAL '30' day)`,
    );
    const totalReviewsAdded30Days = parseInt(
      totalReviewsAdded30DaysQuery[0].total,
      10,
    );

    const totalReviewsAddedQuery = await this.entityManager.execute(
      `SELECT COUNT(*) as total from reviews`,
    );
    const totalReviewsAdded = parseInt(totalReviewsAddedQuery[0].total, 10);

    const result: ApiAdminStats = {
      nbUsers: totalUsers,
      nbUsersConnectedLast30Days: totalUsersConnected30Days,
      nbUsersSignInLast7Days: totalUsersSignInLast7Days,
      nbUsersAndroid: nbAndroid,
      nbUsersApple: nbApple,
      nbUsersOthers: nbOthers,
      nbPlaces: totalPlacesAdded,
      nbPlacesAddedLast30Days: totalPlacesAdded30Days,
      nbReviews: totalReviewsAdded,
      nbReviewsAddedLast30Days: totalReviewsAdded30Days,
    };

    return result;
  }
}
