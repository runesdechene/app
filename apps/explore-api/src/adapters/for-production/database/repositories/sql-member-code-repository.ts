import { Optional } from '../../../../app/libs/shared/optional.js';
import { MemberCode } from '../../../../app/domain/entities/member-code.js';
import { IMemberCodeRepository } from '../../../../app/application/ports/repositories/member-code-repository.js';
import { BaseSqlRepository } from '../base-sql-repository.js';

export class SqlMemberCodeRepository
  extends BaseSqlRepository<MemberCode>
  implements IMemberCodeRepository
{
  async byCode(code: string) {
    const record = await this.repository.findOne({ code });
    return Optional.of(record ? record : null);
  }
}
