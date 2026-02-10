import { startDocker, stopDocker } from './docker-helpers.js';

export const setup = async () => {
  await startDocker();
};

export const teardown = async () => {
  await stopDocker();
};
