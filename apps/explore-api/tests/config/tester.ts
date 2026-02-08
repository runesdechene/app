import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Type } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { ConfigModule } from '@nestjs/config';

import { MikroOrmProvider } from '../../src/adapters/for-production/database/mikro-orm-provider.js';
import { AppModule } from '../../src/app/app-module.js';
import { ITester } from './tester.interface.js';
import { IFixture } from './fixture.interface.js';
import { IMailTester } from './mail-tester.interface.js';

import { LoopbackMailTester } from './loopback-mail-tester.js';
import {
  I_MAILER,
  IMailer,
} from '../../src/app/application/ports/services/mailer.interface.js';
import { LoopbackMailer } from '../../src/adapters/for-tests/services/loopback-mailer.js';
import { testConfig } from './test-config.js';
import multipart from '@fastify/multipart';

export class Tester implements ITester {
  private app: NestFastifyApplication;
  private orm: MikroOrmProvider;
  private mailTester: IMailTester;

  async beforeAll() {
    const config = testConfig();

    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          isGlobal: true,
          load: [() => config],
        }),
        AppModule,
      ],
    }).compile();

    this.app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    await this.app.register(multipart as any);
    await this.app.init();
    await this.app.getHttpAdapter().getInstance().ready();

    this.orm = new MikroOrmProvider(this.app.get(MikroORM));
    await this.orm.init();

    this.mailTester = this.createMailTester();
  }

  async beforeEach() {
    // Unused for now
  }

  async afterEach() {
    // Unused for now
  }

  async afterAll() {
    if (this.app) {
      await this.app.close();
    }
  }

  async initialize(fixtures: IFixture[]) {
    for (const fixture of fixtures) {
      await fixture.load(this);
    }

    await this.orm.flush();
  }

  getHttpServer() {
    return (this.app as any).getHttpServer();
  }

  get<T = any>(token: string | symbol | Type<T>) {
    return this.app.get<T>(token);
  }

  getOrm() {
    return this.orm;
  }

  clearDatabase() {
    return this.orm.truncate();
  }

  private createMailTester(): IMailTester {
    const mailer = this.get<IMailer>(I_MAILER);
    if (mailer instanceof LoopbackMailer) {
      return new LoopbackMailTester(mailer);
    }

    throw new Error('Unsupported mailer');
  }

  getMailTester(): IMailTester {
    return this.mailTester;
  }
}
