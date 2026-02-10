import { Readable } from 'stream';

export enum StorageType {
  ASSETS = 'assets',
  LOGS = 'logs',
}

export enum Cache {
  ONE_YEAR = 'public, max-age=31536000',
}

export type StorableBody = Buffer | Uint8Array | Blob | string | Readable;

export class Storable {
  constructor(
    public readonly props: {
      key: string; // The key serves as the storable identifier
      body: StorableBody;
      contentType?: string;
      metadata?: Record<string, string>;
      cache?: Cache;
      storageType?: StorageType;
      url?: string;
    },
  ) {
    this.props.storageType = props.storageType ?? StorageType.ASSETS;
  }

  toStored(url: string): Storable {
    return new Storable({
      ...this.props,
      url,
    });
  }

  getBody(): StorableBody {
    return this.props.body;
  }

  getUrl(): string {
    return this.props.url!;
  }

  getKey(): string {
    return this.props.key;
  }
}
