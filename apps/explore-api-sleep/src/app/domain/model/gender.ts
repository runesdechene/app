export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  UNKNOWN = 'unknown',
}

export class GenderUtils {
  static fromUnknown(value: string): Gender {
    if (
      value === Gender.MALE ||
      value === Gender.FEMALE ||
      value === Gender.UNKNOWN
    ) {
      return value;
    }

    return Gender.UNKNOWN;
  }
}
