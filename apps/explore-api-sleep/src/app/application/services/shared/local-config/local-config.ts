import { ILocalConfig } from './local-config.interface.js';
import { ConfigService } from '@nestjs/config';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class LocalConfig implements ILocalConfig {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  isTest(): boolean {
    return this.configService.getOrThrow<string>('ENVIRONMENT') === 'test';
  }

  isDev(): boolean {
    return this.configService.getOrThrow<string>('ENVIRONMENT') === 'dev';
  }

  getOrThrow<T>(key: string): T {
    return this.configService.getOrThrow<T>(key);
  }
}
