export class HttpRemote {
  private readonly base: URL
  constructor(base: string) {
    this.base = new URL(base)
  }

  toString() {
    return this.base.toString()
  }

  combine(path: string): string {
    return new URL(path, this.base).toString()
  }
}
