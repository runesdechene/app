import { startDocker, stopDocker } from './docker-helpers';

beforeAll(async () => {
  await startDocker();
});

afterAll(async () => {
  await stopDocker();
});
