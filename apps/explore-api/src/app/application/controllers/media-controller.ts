import { Controller, Post, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { CommandBus } from '@nestjs/cqrs';

import { StoreAsMediaCommand } from '../commands/medias/store-as-media.js';
import { StoreAsUrlCommand } from '../commands/medias/store-as-url.js';
import { WithAuthContext } from '../guards/with-auth-context.js';
import { AuthContext } from '../../domain/model/auth-context.js';
import { ImageProvider } from '../services/media/image-provider.js';

@Controller('/medias')
export class MediaController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('store-as-media')
  async storeAsMedia(
    @Req() request: FastifyRequest,
    @WithAuthContext() authContext: AuthContext,
  ) {
    const file = await ImageProvider.fromFastifyRequest(request, {
      fieldName: 'image',
    });

    return this.commandBus.execute(new StoreAsMediaCommand(file!, authContext));
  }

  @Post('store-as-url')
  async storeAsUrl(
    @Req() request: FastifyRequest,
    @WithAuthContext() userContext: AuthContext,
  ) {
    const file = await ImageProvider.fromFastifyRequest(request, {
      fieldName: 'image',
    });

    return this.commandBus.execute(new StoreAsUrlCommand(file!, userContext));
  }
}
