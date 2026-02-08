export interface ILocalConfig {
  isTest(): boolean;

  isDev(): boolean;

  getOrThrow<T>(key: string): T;
}
