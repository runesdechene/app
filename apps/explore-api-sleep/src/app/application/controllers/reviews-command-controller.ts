import { Body, Controller, Delete, HttpCode, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { WithAuthContext } from '../guards/with-auth-context.js';
import { AuthContext } from '../../domain/model/auth-context.js';
import { CreateReviewCommand } from '../commands/reviews/create-review.js';
import { UpdateReviewCommand } from '../commands/reviews/update-review.js';
import { DeleteReviewCommand } from '../commands/reviews/delete-review.js';

@Controller('reviews')
export class ReviewsCommandController {
  constructor(private readonly commandBus: CommandBus) {}

  @HttpCode(200)
  @Post('create-review')
  async createReview(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.commandBus.execute(new CreateReviewCommand(context, body));
  }

  @HttpCode(200)
  @Post('update-review')
  async updateReview(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.commandBus.execute(new UpdateReviewCommand(context, body));
  }

  @HttpCode(200)
  @Delete('delete-review')
  async deleteReview(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.commandBus.execute(new DeleteReviewCommand(context, body));
  }
}
