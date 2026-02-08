import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { AppModule } from './app/app-module.js';

@Module({
  imports: [
    AppModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
})
export class BootstrapModule {}
