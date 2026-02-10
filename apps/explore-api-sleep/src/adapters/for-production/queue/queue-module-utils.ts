import { BullModule } from '@nestjs/bullmq';
import { ConnectionManager } from './connection-manager.js';

export class QueueModuleUtils {
  static registerQueue(params: { name: string }) {
    return BullModule.registerQueueAsync({
      name: params.name,
      imports: [],
      inject: [ConnectionManager],
      useFactory: (connectionManager: ConnectionManager) => {
        const connection = connectionManager.createClient(params.name);

        return {
          name: params.name,
          connection,
          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: true,
          },
        };
      },
    });
  }
}
