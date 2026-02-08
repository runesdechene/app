import { IDateProvider } from '../../../app/application/ports/services/date-provider.interface.js';

export class FixedDateProvider implements IDateProvider {
  constructor(
    private readonly date: Date = new Date('2024-01-01T00:00:00.000Z'),
  ) {}

  now(): Date {
    return this.date;
  }
}
