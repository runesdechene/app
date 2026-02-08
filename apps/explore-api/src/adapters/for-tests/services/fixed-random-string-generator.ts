import { IRandomStringGenerator } from '../../../app/application/ports/services/random-string-generator.interface.js';

export class FixedRandomStringGenerator implements IRandomStringGenerator {
  public readonly VALUE = 'fixed-random-string';

  async generate(): Promise<string> {
    return this.VALUE;
  }
}
