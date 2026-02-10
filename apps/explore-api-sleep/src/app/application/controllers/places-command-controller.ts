import { Body, Controller, Delete, HttpCode, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { WithAuthContext } from '../guards/with-auth-context.js';
import { AuthContext } from '../../domain/model/auth-context.js';
import { CreatePlaceCommand } from '../commands/places/create-place.js';
import { UpdatePlaceCommand } from '../commands/places/update-place.js';
import { DeletePlaceCommand } from '../commands/places/delete-place.js';

@Controller('places')
export class PlacesCommandController {
  constructor(private readonly commandBus: CommandBus) {}

  @HttpCode(200)
  @Post('create-place')
  async createPlace(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.commandBus.execute(new CreatePlaceCommand(context, body));
  }

  @HttpCode(200)
  @Post('update-place')
  async updatePlace(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.commandBus.execute(new UpdatePlaceCommand(context, body));
  }

  @HttpCode(200)
  @Delete('delete-place')
  async deletePlace(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.commandBus.execute(new DeletePlaceCommand(context, body));
  }
}
