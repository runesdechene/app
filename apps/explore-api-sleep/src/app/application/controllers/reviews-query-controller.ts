import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { WithAuthContext } from '../guards/with-auth-context.js';
import { AuthContext } from '../../domain/model/auth-context.js';
import { PublicRoute } from '../guards/public-route.js';
import { GetPlaceReviewsQuery } from '../queries/get-place-reviews.js';
import { GetReviewByIdQuery } from '../queries/get-review-by-id-query.js';

@Controller('reviews')
export class ReviewsQueryController {
  constructor(private readonly queryBus: QueryBus) {}

  @PublicRoute()
  @HttpCode(200)
  @Post('get-place-reviews')
  async getPlaceReviews(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.queryBus.execute(new GetPlaceReviewsQuery(context, body));
  }

  @PublicRoute()
  @HttpCode(200)
  @Get('get-review-by-id')
  async getReviewById(
    @WithAuthContext() context: AuthContext,
    @Query('id') id: string,
  ) {
    return this.queryBus.execute(new GetReviewByIdQuery(context, { id }));
  }
}
