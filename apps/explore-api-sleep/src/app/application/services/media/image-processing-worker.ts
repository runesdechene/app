import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { CommandBus } from '@nestjs/cqrs';
import { Job } from 'bullmq';
import { CompressImageCommand } from '../../commands/medias/compress-image.js';

export const IMAGE_COMPRESSING_WORKER = 'image-compressing';
export const COMPRESS_IMAGE_JOB = 'compress-image';
export type CompressImageJob = {
  imageId: string;
};

@Processor(IMAGE_COMPRESSING_WORKER)
export class ImageCompressingWorker extends WorkerHost {
  constructor(
    private readonly orm: MikroORM,
    private readonly commandBus: CommandBus,
  ) {
    super();
  }

  @CreateRequestContext()
  async process(job: Job<CompressImageJob>): Promise<any> {
    switch (job.name) {
      case COMPRESS_IMAGE_JOB: {
        const imageId = job.data.imageId;
        try {
          await this.commandBus.execute(new CompressImageCommand(imageId));
          await this.orm.em.flush();
        } catch (e) {
          console.error(e);
        }
        break;
      }
    }
  }
}
