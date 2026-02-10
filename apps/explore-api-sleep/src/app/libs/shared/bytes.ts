export class Bytes {
  constructor(private readonly value: number) {}

  static kilobytes(value: number) {
    return new Bytes(value * 1000);
  }

  static megabytes(value: number) {
    return new Bytes(value * 1000 * 1000);
  }

  static gigabytes(value: number) {
    return new Bytes(value * 1000 * 1000 * 1000);
  }

  toInt() {
    return this.value;
  }

  toKilobytes() {
    return this.value / 1000;
  }

  toMegabytes() {
    return this.value / 1000 / 1000;
  }

  toGigabytes() {
    return this.value / 1000 / 1000 / 1000;
  }

  add(other: Bytes) {
    return new Bytes(this.value + other.value);
  }

  subtract(other: Bytes) {
    return new Bytes(this.value - other.value);
  }

  isGreaterThan(other: Bytes) {
    return this.value > other.value;
  }

  isGreaterOrEqualThan(other: Bytes) {
    return this.value >= other.value;
  }

  isLessThan(other: Bytes) {
    return this.value < other.value;
  }

  isLessOrEqualThan(other: Bytes) {
    return this.value <= other.value;
  }

  equals(other: Bytes) {
    return this.value === other.value;
  }
}
