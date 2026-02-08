import { BootstrapModule } from './bootstrap-module.js';
import { CommandFactory } from 'nest-commander';

async function bootstrap() {
  await CommandFactory.run(BootstrapModule);
}

bootstrap();
