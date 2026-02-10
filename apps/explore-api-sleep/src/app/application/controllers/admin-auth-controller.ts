import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetUserByIdQuery } from '../admin-queries/get-user-by-id.js';
import { WithAuthContext } from '../guards/with-auth-context.js';
import { AuthContext } from '../../domain/model/auth-context.js';
import { RequiresAdmin } from '../guards/requires-admin.js';
import { GetAllUsersQuery } from '../admin-queries/get-all-users.js';
import { GetAdminStatsQuery } from '../admin-queries/get-admin-stats.js';
import { GetAdminRootPlaceTypesQuery } from '../admin-queries/get-admin-root-place-types.js';
import { GetAdminChildrenPlaceTypesQuery } from '../admin-queries/get-admin-children-place-types.js';

@RequiresAdmin()
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly queryBus: QueryBus) {}

  /*@HttpCode(200)
  @Get('get-user-by-id')
  async getUserById(
    @WithAuthContext() context: AuthContext,
    @Query('id') id: string,
  ) {
    return this.queryBus.execute(new GetUserByIdQuery(context, { id }));
  }

  @HttpCode(200)
  @Post('get-all-users')
  async getLikedPlaces(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.queryBus.execute(new GetAllUsersQuery(context, body));
  }*/

  @HttpCode(200)
  @Get('stats')
  async getAdminStats(@WithAuthContext() context: AuthContext) {
    return this.queryBus.execute(new GetAdminStatsQuery(context, {}));
  }

  @HttpCode(200)
  @Get('get-admin-root-place-types')
  async getAdminRootPlaceTypes(@WithAuthContext() context: AuthContext) {
    return this.queryBus.execute(new GetAdminRootPlaceTypesQuery(context));
  }

  @HttpCode(200)
  @Get('get-admin-children-place-types')
  async getAdminChildrenPlaceTypes(
    @WithAuthContext() context: AuthContext,
    @Query('parentId') parentId: string,
  ) {
    return this.queryBus.execute(
      new GetAdminChildrenPlaceTypesQuery(context, { parentId }),
    );
  }
}
