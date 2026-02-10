import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { RegisterCommand } from '../commands/auth/register.js';
import { RequiresGuest } from '../guards/requires-guest.js';

@Controller()
export class AuthRegisterController {
  constructor(private readonly commandBus: CommandBus) {}

  @RequiresGuest()
  @Post('auth/register')
  @HttpCode(200)
  async register(@Body() body: any) {
    return this.commandBus.execute(new RegisterCommand(null, body));
  }
}
