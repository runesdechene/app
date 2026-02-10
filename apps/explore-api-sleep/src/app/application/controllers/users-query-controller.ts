import { Controller, Get, HttpCode, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { WithAuthContext } from '../guards/with-auth-context.js';
import { AuthContext } from '../../domain/model/auth-context.js';
import { GetUserProfileQuery } from '../queries/get-user-profile.js';

@Controller('users')
export class UsersQueryController {
  constructor(private readonly queryBus: QueryBus) {}

  @HttpCode(200)
  @Get('get-user-profile')
  async getPlaceById(
    @WithAuthContext() context: AuthContext,
    @Query('id') id: string,
  ) {
    return this.queryBus.execute(new GetUserProfileQuery(context, { id }));
  }
}
