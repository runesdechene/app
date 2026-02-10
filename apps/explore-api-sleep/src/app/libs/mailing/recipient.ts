type Snapshot = {
  name: string;
  email: string;
};

export class Recipient {
  constructor(
    public name: string,
    public email: string,
  ) {}

  static fromSnapshot(snapshot: Snapshot): Recipient {
    return new Recipient(snapshot.name, snapshot.email);
  }

  format() {
    return `${this.name} <${this.email}>`;
  }

  takeSnapshot(): Snapshot {
    return {
      name: this.name,
      email: this.email,
    };
  }
}
