import { Queue } from 'bullmq';
import {
  COMPRESS_IMAGE_JOB,
  CompressImageJob,
} from '../../../app/application/services/media/image-processing-worker.js';
import { IImageCompressingQueue } from '../../../app/application/ports/queues/image-compressing-queue.js';

export class BullImageCompressingQueue implements IImageCompressingQueue {
  constructor(private readonly queue: Queue) {}

  async enqueue(imageId: string): Promise<void> {
    const job: CompressImageJob = {
      imageId,
    };

    await this.queue.add(COMPRESS_IMAGE_JOB, job, {
      delay: 1000,
      attempts: 3,
    });
  }
}
