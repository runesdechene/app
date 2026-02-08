import { Body, Controller, Delete, HttpCode, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { WithAuthContext } from '../guards/with-auth-context.js';
import { AuthContext } from '../../domain/model/auth-context.js';
import { BookmarkPlaceCommand } from '../commands/places/bookmark-place.js';
import { ExplorePlaceCommand } from '../commands/places/explore-place.js';
import { LikePlaceCommand } from '../commands/places/like-place.js';
import { RemoveBookmarkPlaceCommand } from '../commands/places/remove-bookmark-place.js';
import { RemoveExplorePlaceCommand } from '../commands/places/remove-explore-place.js';
import { RemoveLikePlaceCommand } from '../commands/places/remove-like-place.js';
import { ViewPlaceCommand } from '../commands/places/view-place.js';

@Controller('places')
export class PlacesActionsController {
  constructor(private readonly commandBus: CommandBus) {}

  @HttpCode(200)
  @Post('bookmark-place')
  async bookmarkPlace(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.commandBus.execute(new BookmarkPlaceCommand(context, body));
  }

  @HttpCode(200)
  @Post('explore-place')
  async explorePlace(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.commandBus.execute(new ExplorePlaceCommand(context, body));
  }

  @HttpCode(200)
  @Post('like-place')
  async likePlace(@WithAuthContext() context: AuthContext, @Body() body: any) {
    return this.commandBus.execute(new LikePlaceCommand(context, body));
  }

  @HttpCode(200)
  @Delete('remove-bookmark-place')
  async removeBookmarkPlace(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.commandBus.execute(
      new RemoveBookmarkPlaceCommand(context, body),
    );
  }

  @HttpCode(200)
  @Delete('remove-explore-place')
  async removeExplorePlace(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.commandBus.execute(
      new RemoveExplorePlaceCommand(context, body),
    );
  }

  @HttpCode(200)
  @Delete('remove-like-place')
  async removeLikePlace(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.commandBus.execute(new RemoveLikePlaceCommand(context, body));
  }

  @HttpCode(200)
  @Post('view-place')
  async viewPlace(@WithAuthContext() context: AuthContext, @Body() body: any) {
    return this.commandBus.execute(new ViewPlaceCommand(context, body));
  }
}
