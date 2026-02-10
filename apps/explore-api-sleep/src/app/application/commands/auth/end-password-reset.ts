import { CommandHandler } from '@nestjs/cqrs';
import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../ports/repositories/user-repository.js';
import { Inject } from '@nestjs/common';
import {
  I_PASSWORD_RESET_REPOSITORY,
  IPasswordResetRepository,
} from '../../ports/repositories/password-reset-repository.js';
import {
  I_PASSWORD_STRATEGY,
  IPasswordStrategy,
} from '../../services/auth/password-strategy/password-strategy.interface.js';
import { Optional } from '../../../libs/shared/optional.js';
import { EndPasswordResetEmail } from '../../emails/end-password-reset-email.js';
import {
  BaseCommand,
  BaseCommandHandler,
} from '../../../libs/shared/command.js';
import { I_TRANSLATOR, ITranslator } from '../../../libs/i18n/translator.js';
import { I_MAILER, IMailer } from '../../ports/services/mailer.interface.js';
import {
  I_DATE_PROVIDER,
  IDateProvider,
} from '../../ports/services/date-provider.interface.js';
import { BadRequestException } from '../../../libs/exceptions/bad-request-exception.js';
import { MailBuilder } from '../../../libs/mailing/mail-builder.js';
import z from 'zod';
import { User } from '../../../domain/entities/user.js';
import { PasswordReset } from '../../../domain/entities/password-reset.js';

type Props = {
  code: string;
  nextPassword: string;
};

export class EndPasswordResetCommand extends BaseCommand<Props> {
  validate(props: Props) {
    return z
      .object({
        code: z.string().max(6),
        nextPassword: z.string().max(255),
      })
      .parse(props);
  }
}

@CommandHandler(EndPasswordResetCommand)
export class EndPasswordResetCommandHandler extends BaseCommandHandler<
  EndPasswordResetCommand,
  void
> {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_PASSWORD_RESET_REPOSITORY)
    private readonly passwordResetRepository: IPasswordResetRepository,
    @Inject(I_PASSWORD_STRATEGY)
    private readonly passwordStrategy: IPasswordStrategy,
    @Inject(I_TRANSLATOR)
    private readonly translator: ITranslator,
    @Inject(I_MAILER)
    private readonly mailer: IMailer,
    @Inject(I_DATE_PROVIDER)
    private readonly dateProvider: IDateProvider,
  ) {
    super();
  }

  async execute(command: EndPasswordResetCommand) {
    const props = command.props();

    const passwordReset = await this.fetchPasswordReset(props.code);
    this.check(passwordReset);

    const user = await this.fetchUser(passwordReset);

    await this.changePassword(props.nextPassword, user, passwordReset);
    await this.sendEmail(user);
  }

  private async changePassword(
    password: string,
    user: User,
    passwordReset: PasswordReset,
  ) {
    await user.changePassword(password, this.passwordStrategy);
    passwordReset.consume();

    await this.userRepository.save(user);
    await this.passwordResetRepository.save(passwordReset);
  }

  private async fetchUser(passwordReset: PasswordReset) {
    return this.userRepository
      .byId(passwordReset.user.id)
      .then(Optional.getOrThrow());
  }

  private check(passwordReset: PasswordReset) {
    if (passwordReset.hasExpired(this.dateProvider)) {
      throw BadRequestException.create('EXPIRED_CODE', 'The code has expired');
    }

    if (passwordReset.isConsumed) {
      throw BadRequestException.create(
        'CONSUMED_CODE',
        'The code has been consumed',
      );
    }
  }

  private async fetchPasswordReset(code: string) {
    return this.passwordResetRepository
      .byCode(code)
      .then(
        Optional.getOrThrow(() =>
          BadRequestException.create('INVALID_CODE', 'Invalid code'),
        ),
      );
  }

  private async sendEmail(user: User) {
    const output = await new EndPasswordResetEmail(this.translator).render({
      lang: 'fr',
    });

    await this.mailer.send(
      new MailBuilder()
        .to(user.emailAddress)
        .subject('Mot de passe réinitialisé')
        .htmlBody(output)
        .build(),
    );
  }
}
