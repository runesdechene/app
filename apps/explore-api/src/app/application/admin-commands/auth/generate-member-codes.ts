import { CommandHandler } from '@nestjs/cqrs';
import z from 'zod';
import {
  BaseCommand,
  BaseCommandHandler,
} from '../../../libs/shared/command.js';

type Props = {
  quantity: number;
};

type Output = {
  url: string;
};

export class GenerateMemberCodesCommand extends BaseCommand<Props> {
  validate(props: Props): any {
    return z
      .object({
        quantity: z.number().int().positive().max(10000),
      })
      .parse(props);
  }
}

@CommandHandler(GenerateMemberCodesCommand)
export class GenerateMemberCodesCommandHandler extends BaseCommandHandler<
  GenerateMemberCodesCommand,
  Output
> {
  constructor() {
    super();
  }

  async execute(command: GenerateMemberCodesCommand): Promise<Output> {
    return {
      url: 'https://example.com/1234',
    };
  }
}
