import { IPasswordResetRepository } from '../../../../app/application/ports/repositories/password-reset-repository.js';
import { PasswordReset } from '../../../../app/domain/entities/password-reset.js';
import { BaseRamRepository } from '../base-ram-repository.js';

export class RamPasswordResetRepository
  extends BaseRamRepository<PasswordReset>
  implements IPasswordResetRepository
{
  async byCode(code: string) {
    return this.findOne((passwordReset) => passwordReset.code === code);
  }
}
