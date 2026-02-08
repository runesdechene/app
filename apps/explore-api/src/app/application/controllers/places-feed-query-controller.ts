import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetRegularFeedQuery } from '../queries/get-regular-feed.js';
import { WithAuthContext } from '../guards/with-auth-context.js';
import { AuthContext } from '../../domain/model/auth-context.js';
import { GetPlaceByIdQuery } from '../queries/get-place-by-id.js';
import { GetMapPlacesQuery } from '../queries/get-map-places.js';
import { GetLikedPlacesQuery } from '../queries/get-liked-places.js';
import { GetExploredPlacesQuery } from '../queries/get-explored-places.js';
import { GetBookmarkedPlacesQuery } from '../queries/get-bookmarked-places.js';
import { GetAddedPlacesQuery } from '../queries/get-added-places.js';
import { PublicRoute } from '../guards/public-route.js';
import { GetTotalPlacesQuery } from '../queries/get-total-places.js';
import { GetMapBannersQuery } from '../queries/get-map-banners.js';
import { GetBannerFeedQuery } from '../queries/get-banner-feed.js';

@Controller('places')
export class PlacesFeedQueryController {
  constructor(private readonly queryBus: QueryBus) {}

  @PublicRoute()
  @HttpCode(200)
  @Post('get-map-places')
  async getMapPlaces(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.queryBus.execute(new GetMapPlacesQuery(context, body));
  }

  @PublicRoute()
  @HttpCode(200)
  @Post('get-map-banners')
  async getMapBanners(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.queryBus.execute(new GetMapBannersQuery(context, body));
  }

  @PublicRoute()
  @HttpCode(200)
  @Post('get-regular-feed')
  async getRegularFeed(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.queryBus.execute(new GetRegularFeedQuery(context, body));
  }

  @PublicRoute()
  @HttpCode(200)
  @Post('get-banner-feed')
  async getBannerFeed(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.queryBus.execute(new GetBannerFeedQuery(context, body));
  }

  @PublicRoute()
  @HttpCode(200)
  @Post('get-liked-places')
  async getLikedPlaces(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.queryBus.execute(new GetLikedPlacesQuery(context, body));
  }

  @PublicRoute()
  @HttpCode(200)
  @Post('get-explored-places')
  async getExploredPlaces(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.queryBus.execute(new GetExploredPlacesQuery(context, body));
  }

  @PublicRoute()
  @HttpCode(200)
  @Post('get-bookmarked-places')
  async getBookmarkedPlaces(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.queryBus.execute(new GetBookmarkedPlacesQuery(context, body));
  }

  @PublicRoute()
  @HttpCode(200)
  @Post('get-added-places')
  async getAddedPlaces(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.queryBus.execute(new GetAddedPlacesQuery(context, body));
  }

  @PublicRoute()
  @HttpCode(200)
  @Get('get-place-by-id')
  async getPlaceById(
    @WithAuthContext() context: AuthContext,
    @Query('id') id: string,
  ) {
    return this.queryBus.execute(new GetPlaceByIdQuery(context, { id }));
  }

  @PublicRoute()
  @HttpCode(200)
  @Get('get-total-places')
  async getTotalPlaces(@WithAuthContext() context: AuthContext) {
    return this.queryBus.execute(new GetTotalPlacesQuery(context));
  }
}
