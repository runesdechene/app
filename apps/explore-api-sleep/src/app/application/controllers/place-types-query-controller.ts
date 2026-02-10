import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { WithAuthContext } from '../guards/with-auth-context.js';
import { AuthContext } from '../../domain/model/auth-context.js';
import { GetRootPlaceTypesQuery } from '../queries/get-root-place-types.js';
import { GetChildrenPlaceTypesQuery } from '../queries/get-children-place-types.js';
import { PublicRoute } from '../guards/public-route.js';

@Controller('places')
export class PlaceTypesQueryController {
  constructor(private readonly queryBus: QueryBus) {}

  @PublicRoute()
  @Get('get-root-place-types')
  async getRootPlaceTypes(@WithAuthContext() context: AuthContext) {
    return this.queryBus.execute(new GetRootPlaceTypesQuery(context));
  }

  @PublicRoute()
  @Get('get-children-place-types')
  async getChildrenPlaceTypes(
    @WithAuthContext() context: AuthContext,
    @Query('parentId') parentId: string,
  ) {
    return this.queryBus.execute(
      new GetChildrenPlaceTypesQuery(context, { parentId }),
    );
  }
}
