import { IPasswordStrategy } from './password-strategy.interface.js';

export class PassthroughPasswordStrategy implements IPasswordStrategy {
  async hash(password: string): Promise<string> {
    return password;
  }

  async equals(password: string, hashedPassword: string): Promise<boolean> {
    return password === hashedPassword;
  }
}
