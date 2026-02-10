import { IPasswordResetRepository } from '../../../../app/application/ports/repositories/password-reset-repository.js';
import { PasswordReset } from '../../../../app/domain/entities/password-reset.js';
import { Optional } from '../../../../app/libs/shared/optional.js';
import { BaseSqlRepository } from '../base-sql-repository.js';

export class SqlPasswordResetRepository
  extends BaseSqlRepository<PasswordReset>
  implements IPasswordResetRepository
{
  async byCode(code: string) {
    const record = await this.repository.findOne({ code });
    return Optional.of(record ? record : null);
  }
}
