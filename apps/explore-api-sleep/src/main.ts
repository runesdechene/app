import multipart from '@fastify/multipart';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { BootstrapModule } from './bootstrap-module.js';

async function bootstrap() {
  const port = process.env.PORT ?? 3001;

  const app = await NestFactory.create<NestFastifyApplication>(
    BootstrapModule,
    new FastifyAdapter(),
  );

  await app.register(multipart as any);

  await app.listen(port, '0.0.0.0', () => {
    console.log(`Listening at http://localhost:${port}`);
  });
}

bootstrap();
