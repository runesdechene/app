import { Storable } from '../../../app/libs/storage/storable.js';
import { IStorage } from '../../../app/application/ports/services/storage.interface.js';

export class InMemoryStorage implements IStorage {
  private storage = new Map<string, Storable>();

  async store(storable: Storable): Promise<Storable> {
    this.storage.set(storable.getKey(), storable);
    return storable.toStored('https://random-storage.com/' + storable.getKey());
  }

  async load(key: string): Promise<Storable> {
    const storable = this.storage.get(key);
    if (!storable) {
      throw new Error('File not found');
    }

    return storable;
  }

  async delete(storable: Storable): Promise<void> {
    this.storage.delete(storable.props.url!);
  }

  clear() {
    this.storage.clear();
  }
}
