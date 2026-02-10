import { NodemailerMailer } from '../../../../src/adapters/for-production/services/nodemailer-mailer.js';
import { MailServer } from '../../../config/mail-server.js';
import { MailBuilder } from '../../../../src/app/libs/mailing/mail-builder.js';

describe('Nodemailer gateway', () => {
  it('should send an email', async () => {
    const mailServer = new MailServer();

    const gateway = new NodemailerMailer({
      host: mailServer.getHost(),
      port: mailServer.getSMTPPort(),
      username: undefined,
      password: undefined,
    });

    await gateway.send(
      new MailBuilder()
        .from('gdv.fr', 'Guilde des Voyageurs')
        .to('johndoe@gmail.com', 'John Doe')
        .subject("Hey John, it's me, Mario!")
        .htmlBody('How are you doing?')
        .build(),
    );

    const receivedEmails = await mailServer.pollForMessages();
    expect(
      receivedEmails.includesOnce({
        from: `"Guilde des Voyageurs" <gdv.fr>`,
        to: `"John Doe" <johndoe@gmail.com>`,
        subject: "Hey John, it's me, Mario!",
        contentContains: 'How are you doing?',
      }),
    ).toBe(true);
  });
});
