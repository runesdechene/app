import { IIdProvider } from '../../../app/application/ports/services/id-provider.interface.js';

export class FixedIDProvider implements IIdProvider {
  public readonly ID = 'fixed-id';

  getId(): string {
    return this.ID;
  }
}
