/* istanbul ignore file */
import { IDateProvider } from "../../../app/application/ports/services/date-provider.interface.js";

export class SystemDateProvider implements IDateProvider {
  now(): Date {
    return new Date();
  }

  static now(): Date {
    return new Date();
  }
}
