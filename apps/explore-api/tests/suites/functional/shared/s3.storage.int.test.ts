import axios from 'axios';

import { S3Storage } from '../../../../src/adapters/for-production/services/s3.storage.js';
import { SelfClearingStorageDecorator } from '../../../../src/adapters/for-production/services/self-clearing-storage.decorator.js';
import {
  Storable,
  StorageType,
} from '../../../../src/app/libs/storage/storable.js';
import { FileDeletedEvent } from '../../../../src/app/libs/storage/file-deleted-event.js';
import { testConfig } from '../../../config/test-config.js';
import { InMemoryEventDispatcher } from '../../../../src/adapters/for-tests/services/in-memory-event-dispatcher.js';

describe('Technical: S3 Storage', () => {
  let eventDispatcher: InMemoryEventDispatcher;
  let storage: SelfClearingStorageDecorator;

  const storable = new Storable({
    storageType: StorageType.ASSETS,
    key: 'tests/test.txt',
    body: Buffer.from('test'),
    contentType: 'text/plain',
  });

  beforeEach(async () => {
    const config = testConfig();

    const awsConfig = {
      deploymentEnvironment: config.AWS_DEPLOYMENT_ENV,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY,
        secretAccessKey: config.AWS_SECRET_KEY,
      },
      s3: {
        region: config.AWS_S3_REGION,
      },
    };
    eventDispatcher = new InMemoryEventDispatcher();
    storage = new SelfClearingStorageDecorator(
      new S3Storage(awsConfig as any, eventDispatcher),
    );
  });

  it('should upload a file', async () => {
    const stored = await storage.store(storable);
    expect(stored.props).toEqual({
      storageType: StorageType.ASSETS,
      key: 'tests/test.txt',
      body: Buffer.from('test'),
      contentType: 'text/plain',
      metadata: undefined,
      cache: undefined,
      url: expect.stringContaining('tests/test.txt'),
    });

    const response = await axios.get(stored.getUrl());
    expect(response.data).toEqual('test');
  });

  it('should load a file', async () => {
    await storage.store(storable);
    const retrieved = await storage.load('tests/test.txt', StorageType.ASSETS);

    expect(retrieved.props).toEqual({
      storageType: StorageType.ASSETS,
      key: 'tests/test.txt',
      body: Buffer.from('test'),
      contentType: 'text/plain',
      metadata: {},
      cache: undefined,
      url: expect.stringContaining('tests/test.txt'),
    });
  });

  it('should delete a file', async () => {
    const stored = await storage.store(storable);
    await storage.delete(stored);

    expect(eventDispatcher.events[0]).toEqual(new FileDeletedEvent(stored));
    expect(async () => {
      await axios.get(stored.getUrl());
    }).rejects.toThrow();
  });

  afterEach(async () => {
    await storage.cleanAll();
  });
});
