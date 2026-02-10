import { nanoid } from 'nanoid';
import { IIdProvider } from '../../../app/application/ports/services/id-provider.interface.js';

export class RandomIdProvider implements IIdProvider {
  getId(): string {
    return nanoid();
  }

  static getId(): string {
    return nanoid();
  }
}
