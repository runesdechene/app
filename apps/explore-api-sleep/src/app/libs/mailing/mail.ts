import { Header } from './header.js';
import { HTMLEmailBody } from './html-email-body.js';
import { Priority } from './priority.js';
import { Recipient } from './recipient.js';
import { Subject } from './subject.js';

export type MailSnapshot = {
  from: {
    name: string;
    email: string;
  };
  to: {
    name: string;
    email: string;
  };
  body: {
    html: string;
  };
  subject: string;
  priority: string;
  headers: {
    name: string;
    value: string;
  }[];
};

export class Mail {
  constructor(
    public from: Recipient,
    public to: Recipient,
    public body: HTMLEmailBody,
    public subject: Subject,
    public priority: Priority,
    public headers: Header[],
  ) {}

  static fromSnapshot(snapshot: MailSnapshot): Mail {
    return new Mail(
      Recipient.fromSnapshot(snapshot.from),
      Recipient.fromSnapshot(snapshot.to),
      HTMLEmailBody.fromSnapshot({ html: snapshot.body.html }),
      Subject.fromSnapshot({ value: snapshot.subject }),
      Priority.fromString(snapshot.priority),
      snapshot.headers.map((header) => Header.fromSnapshot(header)),
    );
  }

  takeSnapshot(): MailSnapshot {
    return {
      from: this.from.takeSnapshot(),
      to: this.to.takeSnapshot(),
      body: this.body.takeSnapshot(),
      subject: this.subject.takeSnapshot().value,
      priority: this.priority.asString(),
      headers: this.headers.map((header) => header.takeSnapshot()),
    };
  }

  header(name: string): Header | undefined {
    return this.headers.find((header) => header.name === name);
  }
}
