import { IMailer } from '../../src/app/application/ports/services/mailer.interface.js';
import { Mail } from '../../src/app/libs/mailing/mail.js';

export class MockMailer implements IMailer {
  private inbox: Mail[] = [];

  async send(email: Mail): Promise<void> {
    this.inbox.push(email);
  }

  containsExactly(value: number) {
    return this.inbox.length === value;
  }

  reset() {
    this.inbox = [];
  }

  firstMessage() {
    return this.inbox[0];
  }
}
