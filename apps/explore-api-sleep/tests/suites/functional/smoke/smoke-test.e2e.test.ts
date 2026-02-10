import request from 'supertest';
import { Tester } from '../../../config/tester.js';

describe('Feature: Smoke Testing the app', () => {
  const tester = new Tester();

  beforeAll(() => tester.beforeAll());
  beforeEach(() => tester.beforeEach());
  afterEach(() => tester.afterEach());
  afterAll(() => tester.afterAll());

  it('should start the app', async () => {
    return request(tester.getHttpServer()).get('/').expect(200).expect({
      name: 'Guilde des Voyageurs',
    });
  });
});
