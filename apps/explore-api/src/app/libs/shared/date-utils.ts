import { format } from 'date-fns';
import { ValueObjectValidationException } from '../exceptions/value-object-validation-exception.js';

export class DateUtils {
  static toAmericanDate(date: Date) {
    return format(date, 'yyyy-MM-dd');
  }

  static fromAmericanFormat(date: string) {
    const parts = date.split('-');
    if (parts.length !== 3) {
      throw new ValueObjectValidationException('Invalid American Date');
    }

    const day = parseInt(parts[2]).toString().padStart(2, '0');
    const month = parseInt(parts[1]).toString().padStart(2, '0');
    const year = parseInt(parts[0]).toString();

    return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  }
}
