import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { IMailer } from '../ports/services/mailer.interface.js';
import { Mail, MailSnapshot } from '../../libs/mailing/mail.js';

export const MAILER_WORKER = 'email-worker';

export const SEND_EMAIL_JOB_NAME = 'send-email';
export type SendEmailJob = {
  mail: MailSnapshot;
};

@Processor(MAILER_WORKER, {
  limiter: {
    max: 10,
    duration: 1000,
  },
})
export class BullEmailWorker extends WorkerHost {
  constructor(
    private readonly orm: MikroORM,
    private readonly mailer: IMailer,
  ) {
    super();
  }

  @CreateRequestContext()
  async process(job: Job<SendEmailJob>): Promise<any> {
    switch (job.name) {
      case SEND_EMAIL_JOB_NAME: {
        try {
          const jobData = job.data as SendEmailJob;
          await this.mailer.send(Mail.fromSnapshot(jobData.mail));
        } catch (e) {
          console.error(e);
        }

        break;
      }
    }

    await this.orm.em.flush();
  }
}
