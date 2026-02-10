import { Storable, StorageType } from '../../../libs/storage/storable.js';

export const I_STORAGE = Symbol('I_STORAGE');

export interface IStorage {
  store(storable: Storable): Promise<Storable>;

  load(filename: string, type: StorageType): Promise<Storable>;

  delete(storable: Storable): Promise<void>;
}
