import { Header } from './header.js';
import { HTMLEmailBody } from './html-email-body.js';
import { Mail } from './mail.js';
import { Priority } from './priority.js';
import { Recipient } from './recipient.js';
import { Subject } from './subject.js';
import { AppContact } from './app-contact.js';

export class MailBuilder {
  private _from: Recipient;
  private _to: Recipient;
  private _subject: Subject;
  private _body: HTMLEmailBody;
  private _priority = Priority.LOW;
  private _headers: Header[] = [];

  public from(emailAddress: string, name?: string): MailBuilder {
    this._from = new Recipient(name ?? emailAddress, emailAddress);
    return this;
  }

  public to(emailAddress: string, name?: string): MailBuilder {
    this._to = new Recipient(name ?? emailAddress, emailAddress);
    return this;
  }

  public subject(subject: string | Subject): MailBuilder {
    this._subject =
      typeof subject === 'string' ? new Subject(subject) : subject;
    return this;
  }

  public htmlBody(body: string): MailBuilder {
    this._body = new HTMLEmailBody(body);
    return this;
  }

  public withHeader(name: string, value: string) {
    this._headers.push(new Header(name, value));
    return this;
  }

  public build(): any {
    return new Mail(
      this._from ?? new AppContact(),
      this._to,
      this._body,
      this._subject,
      this._priority,
      this._headers,
    );
  }
}
