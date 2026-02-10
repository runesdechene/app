import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ITester } from '../config/tester.interface.js';

export const waitFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const waitForJobToComplete = async ({
  app,
  worker,
  jobName,
  timeout = 5000,
}: {
  app: ITester;
  worker: string;
  jobName: string;
  timeout?: number;
}) => {
  const queue = app.get<Queue>(getQueueToken(worker));
  const jobs = await queue.getJobs();
  const job = jobs.find((job) => job.name === jobName)!;

  expect(job).toBeDefined();

  const startedAt = Date.now();
  while (true) {
    if (Date.now() - startedAt > timeout) {
      throw new Error('Timeout');
    }

    const state = await job.getState();
    if (state === 'completed' || state === 'failed' || state === 'unknown') {
      break;
    }

    await waitFor(5);
  }
};
