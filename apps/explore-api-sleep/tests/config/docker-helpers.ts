import path from 'path';
import {
  DockerComposeEnvironment,
  StartedDockerComposeEnvironment,
} from 'testcontainers';

let environment: StartedDockerComposeEnvironment | null = null;

const getPort = (containerName: string, port: number) => {
  if (!environment) {
    throw new Error('No docker-compose environment found');
  }

  return environment.getContainer(containerName).getMappedPort(port).toString();
};

export const startDocker = async () => {
  const composeFilePath = path.resolve(__dirname);
  const composeFile = 'docker-compose.yml';

  environment = await new DockerComposeEnvironment(
    composeFilePath,
    composeFile,
  ).up();

  process.env.COMPOSE_DB_PORT = getPort('db-1', 5432);
  process.env.COMPOSE_MAILER_SMTP_PORT = getPort('mailer-1', 1025);
  process.env.COMPOSE_MAILER_UI_PORT = getPort('mailer-1', 8025);
  process.env.COMPOSE_REDIS_PORT = getPort('redis-1', 6379);
};

export const stopDocker = async () => {
  if (!environment) {
    console.error('No docker-compose environment found');
    return;
  }

  try {
    await environment.down();
    environment = null;
  } catch (e) {
    console.error('Failed to stop docker-compose', e);
  }
};
