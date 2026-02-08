type Snapshot = {
  html: string;
};
export class HTMLEmailBody {
  constructor(public html: string) {}

  static fromSnapshot(snapshot: Snapshot): HTMLEmailBody {
    return new HTMLEmailBody(snapshot.html);
  }

  takeSnapshot(): Snapshot {
    return {
      html: this.html,
    };
  }
}
