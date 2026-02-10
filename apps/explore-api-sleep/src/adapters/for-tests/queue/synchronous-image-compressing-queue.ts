import { IImageCompressingQueue } from '../../../app/application/ports/queues/image-compressing-queue.js';
import {
  CompressImageCommand,
  CompressImageCommandHandler,
} from '../../../app/application/commands/medias/compress-image.js';

export class SynchronousImageCompressingQueue
  implements IImageCompressingQueue
{
  constructor(private readonly commandHandler: CompressImageCommandHandler) {}

  async enqueue(imageId: string): Promise<void> {
    await this.commandHandler.execute(new CompressImageCommand(imageId));
  }
}
