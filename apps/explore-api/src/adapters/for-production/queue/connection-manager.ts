import { OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { ILogger } from '../../../app/application/ports/services/logger.interface.js';
import { ILocalConfig } from '../../../app/application/services/shared/local-config/local-config.interface.js';

// Stolen from https://github.com/facebook/jest/issues/12262

export class ConnectionManager implements OnApplicationShutdown {
  clients: any[];

  constructor(
    private readonly logger: ILogger,
    private readonly connection: string,
    private readonly config: ILocalConfig,
  ) {
    this.clients = [];
  }

  createClient(name: string): any {
    const client = new Redis.default(this.connection, {
      name,
      maxRetriesPerRequest: null,
    }) as any;

    client.on('error', () => {
      this.logger.error("Queue couldn't connect.");
    });

    this.clients.push(client);
    return client;
  }

  async onApplicationShutdown() {
    if (this.config.getOrThrow('ENVIRONMENT') === 'dev') {
      // Required in dev mode to avoid hanging the process
      await Promise.all(
        this.clients.map((client) => {
          return client.quit();
        }),
      );
    }
  }
}
