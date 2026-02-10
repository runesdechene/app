import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { PublicRoute } from '../guards/public-route.js';
import { BeginPasswordResetCommand } from '../commands/auth/begin-password-reset.js';
import { EndPasswordResetCommand } from '../commands/auth/end-password-reset.js';
import { AuthContext } from '../../domain/model/auth-context.js';
import { WithAuthContext } from '../guards/with-auth-context.js';
import { ChangePasswordCommand } from '../commands/auth/change-password.js';

@Controller()
export class AuthPasswordController {
  constructor(private readonly commandBus: CommandBus) {}

  @PublicRoute()
  @Post('auth/begin-password-reset')
  @HttpCode(200)
  async beginPasswordReset(@Body() body: any) {
    return this.commandBus.execute(new BeginPasswordResetCommand(null, body));
  }

  @PublicRoute()
  @Post('auth/end-password-reset')
  @HttpCode(200)
  async endPasswordReset(@Body() body: any) {
    return this.commandBus.execute(new EndPasswordResetCommand(null, body));
  }

  @Post('auth/change-password')
  @HttpCode(200)
  async changePassword(
    @WithAuthContext() authContext: AuthContext,
    @Body() body: any,
  ) {
    return this.commandBus.execute(
      new ChangePasswordCommand(authContext, body),
    );
  }
}
