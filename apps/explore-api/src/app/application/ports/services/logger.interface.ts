type Params = any[];

export const I_LOGGER = Symbol('I_LOGGER');

export interface ILogger {
  log(message: string, ...params: Params): void;
  error(message: string, ...params: Params): void;
  warn(message: string, ...params: Params): void;
  debug(message: string, ...params: Params): void;
  verbose(message: string, ...params: Params): void;
  info(message: string, ...params: Params): void;
}
