import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { LoginWithCredentialsCommand } from '../commands/auth/login-with-credentials.js';
import { LoginWithRefreshTokenCommand } from '../commands/auth/login-with-refresh-token.js';
import { PublicRoute } from '../guards/public-route.js';

@Controller()
export class AuthLoginController {
  constructor(private readonly commandBus: CommandBus) {}

  @PublicRoute()
  @Post('auth/login-with-credentials')
  @HttpCode(200)
  async loginWithCredentials(@Body() body: any, @Headers() headers: any) {
    return this.commandBus.execute(
      new LoginWithCredentialsCommand(null, body, headers),
    );
  }

  @PublicRoute()
  @Post('auth/login-with-refresh-token')
  @HttpCode(200)
  async loginWithRefreshToken(@Body() body: any, @Headers() headers: any) {
    return this.commandBus.execute(
      new LoginWithRefreshTokenCommand(null, body, headers),
    );
  }
}
