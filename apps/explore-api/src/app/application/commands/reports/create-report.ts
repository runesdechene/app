import { BaseCommand } from '../../../libs/shared/command.js';
import z from 'zod';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { I_MAILER, IMailer } from '../../ports/services/mailer.interface.js';
import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../ports/repositories/user-repository.js';
import { MailBuilder } from '../../../libs/mailing/mail-builder.js';
import {
  I_PLACE_REPOSITORY,
  IPlaceRepository,
} from '../../ports/repositories/place-repository.js';
import { ReportEmail } from '../../emails/report-email.js';

type Payload = {
  message: string;
  context: {
    type: 'place';
    id: string;
  };
};

export class CreateReportCommand extends BaseCommand<Payload> {
  validate(props: Payload): Payload {
    return z
      .object({
        message: z.string(),
        context: z.object({
          type: z.string(),
          id: z.string(),
        }),
      })
      .parse(props) as Payload;
  }
}

@CommandHandler(CreateReportCommand)
export class CreateReportCommandHandler
  implements ICommandHandler<CreateReportCommand>
{
  constructor(
    @Inject(I_MAILER) private readonly mailer: IMailer,
    @Inject(I_USER_REPOSITORY)
    private readonly usersRepository: IUserRepository,
    @Inject(I_PLACE_REPOSITORY)
    private readonly placesRepository: IPlaceRepository,
  ) {}

  async execute(command: CreateReportCommand): Promise<any> {
    const props = command.props();
    const admins = await this.usersRepository.findAdmins();
    const authorQuery = await this.usersRepository.byId(command.auth().id());
    const placeQuery = await this.placesRepository.byId(props.context.id);

    if (!placeQuery.isPresent() || !authorQuery.isPresent()) {
      return null;
    }

    const author = authorQuery.getOrThrow();
    const place = placeQuery.getOrThrow();

    const output = await new ReportEmail().render({
      author,
      place,
      message: command.props().message,
    });

    await Promise.all(
      admins.map((admin) => {
        return this.mailer.send(
          new MailBuilder()
            .to(admin.emailAddress, admin.emailAddress)
            .subject("Signalement sur l'application Runes de Chêne")
            .htmlBody(output)
            .build(),
        );
      }),
    );
  }
}
