type Snapshot = {
  name: string;
  value: string;
};

export class Header {
  constructor(
    public name: string,
    public value: string,
  ) {}

  static fromSnapshot(snapshot: Snapshot): Header {
    return new Header(snapshot.name, snapshot.value);
  }

  takeSnapshot(): Snapshot {
    return {
      name: this.name,
      value: this.value,
    };
  }
}
