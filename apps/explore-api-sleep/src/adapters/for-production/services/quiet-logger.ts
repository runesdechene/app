import { ILogger } from '../../../app/application/ports/services/logger.interface.js';

export class QuietLogger implements ILogger {
  log(): void {}
  error(): void {}
  warn(): void {}
  debug(): void {}
  verbose(): void {}
  info(): void {}
}
