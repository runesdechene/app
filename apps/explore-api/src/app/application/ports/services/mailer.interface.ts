import { Mail } from '../../../libs/mailing/mail.js';

export const I_MAILER = Symbol('I_MAILER');

export interface IMailer {
  send(message: Mail): Promise<void>;
}
