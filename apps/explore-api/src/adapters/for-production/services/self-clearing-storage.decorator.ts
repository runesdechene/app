import { OnApplicationShutdown } from '@nestjs/common';
import { IStorage } from '../../../app/application/ports/services/storage.interface.js';
import { Storable, StorageType } from '../../../app/libs/storage/storable.js';

export class SelfClearingStorageDecorator
  implements IStorage, OnApplicationShutdown
{
  private files: Storable[] = [];

  constructor(private decoratee: IStorage) {}

  async store(storable: Storable): Promise<Storable> {
    const stored = await this.decoratee.store(storable);
    this.files.push(stored);
    return stored;
  }

  async load(filename: string, type: StorageType): Promise<Storable> {
    return await this.decoratee.load(filename, type);
  }

  async delete(storable: Storable): Promise<void> {
    await this.decoratee.delete(storable);
    this.files = this.files.filter(
      (file) => file.props.key !== storable.props.key,
    );
  }

  async cleanAll() {
    await Promise.all(this.files.map((file) => this.delete(file)));
  }

  onApplicationShutdown(signal?: string) {
    return this.cleanAll();
  }
}
