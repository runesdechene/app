import { Queue } from 'bullmq';
import { SEND_EMAIL_JOB_NAME } from '../../../app/application/workers/bull-mailer-worker.js';
import { Mail } from '../../../app/libs/mailing/mail.js';
import { IMailer } from '../../../app/application/ports/services/mailer.interface.js';

export class QueuedMailer implements IMailer {
  constructor(private readonly queue: Queue) {}

  async send(mail: Mail): Promise<void> {
    await this.queue.add(
      SEND_EMAIL_JOB_NAME,
      {
        mail: mail.takeSnapshot(),
      },
      {
        attempts: 7,
        removeOnFail: true,
        removeOnComplete: true,
      },
    );
  }
}
