import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { CreateReportCommand } from '../commands/reports/create-report.js';
import { WithAuthContext } from '../guards/with-auth-context.js';
import { AuthContext } from '../../domain/model/auth-context.js';

@Controller()
export class ReportController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('reports/create-report')
  @HttpCode(200)
  async register(@Body() body: any, @WithAuthContext() auth: AuthContext) {
    return this.commandBus.execute(new CreateReportCommand(auth, body));
  }
}
