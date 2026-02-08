import { IMailTester } from './mail-tester.interface.js';
import { LoopbackMailer } from '../../src/adapters/for-tests/services/loopback-mailer.js';
import { Mail } from '../../src/app/libs/mailing/mail.js';

export class LoopbackMailTester implements IMailTester {
  constructor(private readonly mailer: LoopbackMailer) {}

  assertOnlyOne(): Mail {
    if (!this.mailer.containsQuantity(1)) {
      throw new Error('Expected only one message in the inbox');
    }

    return this.mailer.at(0);
  }
}
