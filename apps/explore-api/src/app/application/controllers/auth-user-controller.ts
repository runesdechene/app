import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { GetMyInformationsQuery } from '../queries/get-my-informations.js';
import { WithAuthContext } from '../guards/with-auth-context.js';
import { AuthContext } from '../../domain/model/auth-context.js';
import { ChangeInformationsCommand } from '../commands/auth/change-informations.js';
import { ActivateAccountCommand } from '../commands/auth/activate-account.js';
import { ChangeEmailAddressCommand } from '../commands/auth/change-email-address.js';
import { DeleteAccountCommand } from '../commands/auth/delete-account.js';

@Controller()
export class AuthUserController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('auth/get-my-informations')
  async loginWithCredentials(@WithAuthContext() context: AuthContext) {
    return this.queryBus.execute(
      new GetMyInformationsQuery(context, undefined),
    );
  }

  @HttpCode(200)
  @Post('auth/change-informations')
  async changeInformations(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.commandBus.execute(
      new ChangeInformationsCommand(context, body),
    );
  }

  @HttpCode(200)
  @Post('auth/change-email-address')
  async changeEmailAddress(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.commandBus.execute(
      new ChangeEmailAddressCommand(context, body),
    );
  }

  @HttpCode(200)
  @Post('auth/activate-account')
  async activateAccount(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.commandBus.execute(new ActivateAccountCommand(context, body));
  }

  @HttpCode(200)
  @Delete('auth/delete-account')
  async deleteAccount(
    @WithAuthContext() context: AuthContext,
    @Body() body: any,
  ) {
    return this.commandBus.execute(new DeleteAccountCommand(context, body));
  }
}
