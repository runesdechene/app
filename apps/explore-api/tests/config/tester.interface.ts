import { Type } from '@nestjs/common';
import * as http from 'http';
import { IFixture } from './fixture.interface.js';
import { IMailTester } from './mail-tester.interface.js';

export interface ITester {
  beforeAll(): Promise<any>;

  beforeEach(): Promise<any>;

  afterEach(): Promise<any>;

  afterAll(): Promise<any>;

  initialize(fixtures: IFixture[]): Promise<void>;

  getHttpServer(): http.Server;

  get<T = any>(token: string | symbol | Type<T>): T;

  getOrm(): any;

  getMailTester(): IMailTester;
}
