export abstract class Wrap<T> {
  protected injected: Wrap<T>;

  abstract expose(): T;

  private inject(value: Wrap<T>): this {
    this.injected = value;
    return this;
  }

  chain(v: Wrap<T>): Wrap<T> {
    return v.inject(this);
  }
}
