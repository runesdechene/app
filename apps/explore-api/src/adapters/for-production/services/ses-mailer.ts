import nodemailer from 'nodemailer';

import * as aws from '@aws-sdk/client-ses';
import { IMailer } from '../../../app/application/ports/services/mailer.interface.js';
import { Mail } from '../../../app/libs/mailing/mail.js';

interface SESGatewayConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export class SESMailer implements IMailer {
  private transporter: nodemailer.Transporter;

  constructor(config: SESGatewayConfig) {
    const ses = new aws.SES({
      apiVersion: '2010-12-01',
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    this.transporter = nodemailer.createTransport({ SES: { ses, aws } });
  }

  async send(mail: Mail): Promise<void> {
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
  }
}
