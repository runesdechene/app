import nodemailer from 'nodemailer';

import { IMailer } from '../../../app/application/ports/services/mailer.interface.js';
import { Mail } from '../../../app/libs/mailing/mail.js';

interface NodemailerGatewayConfig {
  host: string;
  port: number;
  username: string | undefined;
  password: string | undefined;
}

export class NodemailerMailer implements IMailer {
  private transporter: nodemailer.Transporter;

  constructor(config: NodemailerGatewayConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: false,
      auth:
        config.username && config.password
          ? {
              user: config.username,
              pass: config.password,
            }
          : undefined,
    });
  }

  async send(mail: Mail): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: mail.from.format(),
        to: mail.to.format(),
        subject: mail.subject.value,
        html: mail.body.html,
        headers: mail.headers.reduce(
          (headers, header) => ({
            ...headers,
            [header.name]: header.value,
          }),
          {},
        ),
      });
    } catch (e) {
      console.error(e);
    }
  }
}
