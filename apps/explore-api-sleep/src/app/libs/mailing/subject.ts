type Snapshot = {
  value: string;
};

export class Subject {
  constructor(public value: string) {}

  static fromSnapshot(snapshot: Snapshot): Subject {
    return new Subject(snapshot.value);
  }

  takeSnapshot(): Snapshot {
    return {
      value: this.value,
    };
  }
}
