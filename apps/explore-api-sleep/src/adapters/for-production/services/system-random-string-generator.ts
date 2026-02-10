import crypto from 'crypto';
import { IRandomStringGenerator } from '../../../app/application/ports/services/random-string-generator.interface.js';

export class SystemRandomStringGenerator implements IRandomStringGenerator {
  async generate(): Promise<string> {
    return crypto.randomBytes(32).toString('hex');
  }
}
