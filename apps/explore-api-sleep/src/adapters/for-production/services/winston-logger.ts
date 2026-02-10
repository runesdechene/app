import { Logger } from 'winston';
import { ILogger } from '../../../app/application/ports/services/logger.interface.js';

export class WinstonLogger implements ILogger {
  constructor(private readonly winston: Logger) {}

  log(message: string, ...params: any[]): void {
    this.winston.info(message, ...params);
  }

  error(message: string, ...params: any[]): void {
    this.winston.error(message, ...params);
  }

  warn(message: string, ...params: any[]): void {
    this.winston.warn(message, ...params);
  }

  debug(message: string, ...params: any[]): void {
    this.winston.debug(message, ...params);
  }

  verbose(message: string, ...params: any[]): void {
    this.winston.verbose(message, ...params);
  }

  info(message: string, ...params: any[]): void {
    this.winston.info(message, ...params);
  }
}
