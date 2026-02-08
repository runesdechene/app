export class Optional<T> {
  constructor(private readonly value: T | null) {}

  static of<T>(value: T | null | undefined) {
    if (value === null || value === undefined) {
      return new Optional<T>(null);
    }

    return new Optional<T>(value);
  }

  isPresent() {
    return this.value !== null;
  }

  getOrThrow(factory?: () => Error): T {
    if (this.value === null) {
      throw factory?.() ?? new Error('value is not present');
    }

    return this.value;
  }

  getOrNull() {
    return this.value;
  }

  static getOrThrow<T>(factory?: () => Error) {
    return (q: Optional<T>) => q.getOrThrow(factory);
  }

  static getOrNull<T>() {
    return (q: Optional<T>) => q.getOrNull();
  }
}
