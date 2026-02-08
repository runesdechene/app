import axios from 'axios';
import { AddressObject, ParsedMail, simpleParser } from 'mailparser';

type MailgHogReceiver = {
  Relays: any;
  Mailbox: string;
  Domain: string;
  Params: string;
};

type MailHogMessage = {
  ID: string;
  From: MailgHogReceiver;
  To: MailgHogReceiver[];
  Content: {
    Headers: {
      From: [string];
      To: [string];
      Subject: [string];
    };
    Body: string;
    Size: number;
    Mime: null;
  };
  Created: string;
  MIME: any;
  Raw: any;
};

export class MailServer {
  private httpApiUrl: string;

  constructor() {
    this.httpApiUrl = `http://${this.getHost()}:${this.getHTTPPort()}`;
  }

  getHost() {
    return 'localhost';
  }

  getSMTPPort() {
    return parseInt(process.env.COMPOSE_MAILER_SMTP_PORT!, 10);
  }

  getHTTPPort() {
    return parseInt(process.env.COMPOSE_MAILER_UI_PORT!, 10);
  }

  clearAllMessages() {
    return axios.delete(`${this.httpApiUrl}/api/v1/messages`);
  }

  async getMessages() {
    const response = await axios.get<MailHogMessage[]>(
      `${this.httpApiUrl}/api/v1/messages`,
    );

    const messages = await Promise.all(
      response.data.map(async (message) => {
        const parsed = await simpleParser(message.Raw.Data);
        return new Message(parsed);
      }),
    );

    return new Messages(messages);
  }

  async pollForMessages() {
    let messages: Messages = new Messages([]);
    let attempts = 0;

    while (messages.length === 0 && attempts < 50) {
      messages = await this.getMessages();
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return messages;
  }
}

class Messages {
  constructor(public items: Message[]) {}

  includesOnce(info: {
    from: string;
    to: string;
    subject: string;
    contentContains: string;
  }) {
    return this.items.some((message) => {
      const from = message.props.from.text;
      const to = (message.props.to as any).text;
      const subject = message.props.subject;
      const content = message.props.html as string;

      return (
        from === info.from &&
        to === info.to &&
        subject === info.subject &&
        content.includes(info.contentContains)
      );
    });
  }

  get length() {
    return this.items.length;
  }

  at(index: number) {
    return this.items[index];
  }

  find(predicate: (message: Message) => boolean) {
    return this.items.find(predicate);
  }
}

class Message {
  constructor(public readonly props: ParsedMail) {}

  hasContent(content: string) {
    if (!this.props.html) {
      return false;
    }

    return this.props.html.includes(content);
  }

  getSubject() {
    return this.props.subject;
  }

  getSender() {
    return {
      name: this.props.from.value[0].name,
      emailAddress: this.props.from.value[0].address,
    };
  }

  getReceiver() {
    if (Array.isArray(this.props.to)) {
      return {
        name: (this.props.to as AddressObject[])[0].value[0].name,
        emailAddress: (this.props.to as AddressObject[])[0].value[0].address,
      };
    } else {
      return {
        name: (this.props.to as AddressObject).value[0].name,
        emailAddress: (this.props.to as AddressObject).value[0].address,
      };
    }
  }

  getHeader<T>(name: string): T {
    return this.props.headers.get(name) as T;
  }
}
