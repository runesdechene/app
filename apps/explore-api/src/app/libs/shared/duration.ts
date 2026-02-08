import { addSeconds } from 'date-fns';

export class Duration {
  private constructor(private value: number) {}

  static fromMinutes(value: number) {
    return new Duration(value * 60);
  }

  static fromHours(value: number) {
    return new Duration(value * 60 * 60);
  }

  static fromDays(value: number) {
    return new Duration(value * 60 * 60 * 24);
  }

  static fromMilliseconds(value: number) {
    return new Duration(Math.round(value / 1000));
  }

  static fromSeconds(value: number) {
    return new Duration(value);
  }

  toSeconds() {
    return this.value;
  }

  toMilliseconds() {
    return this.value * 1000;
  }

  addToDate(date: Date) {
    return addSeconds(date, this.value);
  }

  equals(other: Duration) {
    return this.value === other.value;
  }
}
