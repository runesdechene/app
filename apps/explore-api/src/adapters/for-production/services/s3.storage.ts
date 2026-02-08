import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { AWSConfig } from '../../../app/application/config/aws-config.js';
import { IStorage } from '../../../app/application/ports/services/storage.interface.js';
import { Storable, StorageType } from '../../../app/libs/storage/storable.js';
import { FileStoredEvent } from '../../../app/libs/storage/file-stored-event.js';
import { FileDeletedEvent } from '../../../app/libs/storage/file-deleted-event.js';
import { IEventDispatcher } from '../../../app/application/ports/services/event-dispatcher.interface.js';

export class S3Storage implements IStorage {
  private s3: S3;

  constructor(
    private readonly config: AWSConfig,
    private readonly eventDispatcher: IEventDispatcher,
  ) {
    this.s3 = new S3({
      credentials: config.credentials,
      region: config.s3.region,
    });
  }

  async store(storable: Storable): Promise<Storable> {
    const command = new PutObjectCommand({
      Bucket: this.storageToBucket(storable.props.storageType!),
      Key: storable.props.key,
      Body: storable.props.body,
      ContentType: storable.props.contentType,
      ...(storable.props.metadata ? { Metadata: storable.props.metadata } : {}),
      ...(storable.props.cache ? { CacheControl: storable.props.cache } : {}),
    });

    await this.s3.send(command);

    const url = await this.getURL(
      storable.props.storageType!,
      storable.props.key,
    );

    const stored = storable.toStored(url);
    await this.eventDispatcher.raise(new FileStoredEvent(stored));
    return stored;
  }

  async load(filename: string, type: StorageType): Promise<Storable> {
    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.storageToBucket(type),
        Key: filename,
      }),
    );

    const stream = response.Body as Readable;
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.once('end', () => resolve(Buffer.concat(chunks)));
      stream.once('error', reject);
    });

    return new Storable({
      storageType: type,
      key: filename,
      body: buffer,
      contentType: response.ContentType,
      metadata: response.Metadata,
      cache: response.CacheControl as any,
      url: await this.getURL(type, filename),
    });
  }

  async delete(storable: Storable): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.storageToBucket(storable.props.storageType!),
        Key: storable.props.key,
      }),
    );

    await this.eventDispatcher.raise(new FileDeletedEvent(storable));
  }

  private storageToBucket(storage: StorageType) {
    let suffix = '';
    if (this.config.deploymentEnvironment !== 'prod') {
      suffix = `-${this.config.deploymentEnvironment}`;
    }

    return `gdv-${storage}${suffix}`;
  }

  private async getURL(bucket: StorageType, name: string) {
    return (
      'https://' +
      this.storageToBucket(bucket) +
      '.s3.' +
      this.config.s3.region +
      '.amazonaws.com/' +
      name
    );
  }
}
