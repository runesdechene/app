import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../ports/repositories/user-repository.js';
import { Optional } from '../../../libs/shared/optional.js';
import {
  I_PASSWORD_RESET_REPOSITORY,
  IPasswordResetRepository,
} from '../../ports/repositories/password-reset-repository.js';
import {
  I_PASSWORD_RESET_CODE_GENERATOR,
  IPassworResetCodeGenerator,
} from '../../services/auth/password-reset-code-generator/password-reset-code-generator.interface.js';
import { Duration } from '../../../libs/shared/duration.js';
import { BeginPasswordResetEmail } from '../../emails/begin-password-reset-email.js';
import {
  BaseCommand,
  BaseCommandHandler,
} from '../../../libs/shared/command.js';
import {
  I_ID_PROVIDER,
  IIdProvider,
} from '../../ports/services/id-provider.interface.js';
import {
  I_DATE_PROVIDER,
  IDateProvider,
} from '../../ports/services/date-provider.interface.js';
import { I_TRANSLATOR, ITranslator } from '../../../libs/i18n/translator.js';
import { I_MAILER, IMailer } from '../../ports/services/mailer.interface.js';
import { MailBuilder } from '../../../libs/mailing/mail-builder.js';
import z from 'zod';
import { User } from '../../../domain/entities/user.js';
import { PasswordReset } from '../../../domain/entities/password-reset.js';
import { ref } from '@mikro-orm/core';

type Props = {
  emailAddress: string;
};

export class BeginPasswordResetCommand extends BaseCommand<Props> {
  validate(props: Props) {
    return z
      .object({
        emailAddress: z.string().email(),
      })
      .parse(props);
  }
}

@CommandHandler(BeginPasswordResetCommand)
export class BeginPasswordResetCommandHandler extends BaseCommandHandler<
  BeginPasswordResetCommand,
  void
> {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_PASSWORD_RESET_REPOSITORY)
    private readonly passwordResetRepository: IPasswordResetRepository,
    @Inject(I_PASSWORD_RESET_CODE_GENERATOR)
    private readonly passwordResetCodeGenerator: IPassworResetCodeGenerator,
    @Inject(I_ID_PROVIDER)
    private readonly idProvider: IIdProvider,
    @Inject(I_DATE_PROVIDER)
    private readonly dateProvider: IDateProvider,
    @Inject(I_TRANSLATOR)
    private readonly translator: ITranslator,
    @Inject(I_MAILER)
    private readonly mailer: IMailer,
  ) {
    super();
  }

  async execute(command: BeginPasswordResetCommand) {
    const props = command.props();
    const user = await this.findUser(props.emailAddress);
    const passwordReset = await this.createPasswordReset(user);
    await this.sendEmail(user, passwordReset);
  }

  async findUser(emailAddress: string) {
    return this.userRepository
      .byEmailAddress(emailAddress)
      .then(Optional.getOrThrow(() => new NotFoundException('User not found')));
  }

  private async createPasswordReset(user: User) {
    const passwordReset = new PasswordReset();
    passwordReset.id = this.idProvider.getId();
    passwordReset.user = ref(User, user.id);
    passwordReset.code = this.passwordResetCodeGenerator.generate();
    passwordReset.expiresAt = new PasswordResetValidity().toDate(
      this.dateProvider,
    );
    passwordReset.isConsumed = false;

    await this.passwordResetRepository.save(passwordReset);
    return passwordReset;
  }

  private async sendEmail(user: User, passwordReset: PasswordReset) {
    const output = await new BeginPasswordResetEmail(this.translator).render({
      lang: 'fr',
      code: passwordReset.code,
    });

    await this.mailer.send(
      new MailBuilder()
        .to(user.emailAddress)
        .subject('Réinitialisation de mot de passe')
        .withHeader('X-Password-Reset-Code', passwordReset.code)
        .htmlBody(output)
        .build(),
    );
  }
}

class PasswordResetValidity {
  toDate(dateProvider: IDateProvider) {
    return Duration.fromHours(2).addToDate(dateProvider.now());
  }
}
