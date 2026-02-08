import { IPassworResetCodeGenerator } from './password-reset-code-generator.interface.js';

export class PasswordResetCodeGenerator implements IPassworResetCodeGenerator {
  private static TABLE = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  private static LENGTH = 6;

  generate() {
    let code = '';
    for (let i = 0; i < PasswordResetCodeGenerator.LENGTH; i++) {
      code += this.nextChar();
    }

    return code;
  }

  private nextChar() {
    return PasswordResetCodeGenerator.TABLE[
      Math.floor(Math.random() * PasswordResetCodeGenerator.TABLE.length)
    ];
  }
}
