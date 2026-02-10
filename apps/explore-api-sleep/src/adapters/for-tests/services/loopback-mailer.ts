import { IMailer } from '../../../app/application/ports/services/mailer.interface.js';
import { Mail } from '../../../app/libs/mailing/mail.js';

export class LoopbackMailer implements IMailer {
  constructor(private inbox: Mail[] = []) {}

  async send(message: Mail) {
    this.inbox.push(message);
  }

  containsQuantity(quantity: number) {
    return this.inbox.length === quantity;
  }

  at(index: number) {
    return this.inbox[index];
  }

  clear() {
    this.inbox = [];
  }
}
