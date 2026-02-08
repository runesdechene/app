import { IMemberCodeRepository } from '../../../../app/application/ports/repositories/member-code-repository.js';
import { BaseRamRepository } from '../base-ram-repository.js';
import { MemberCode } from '../../../../app/domain/entities/member-code.js';

export class RamMemberCodeRepository
  extends BaseRamRepository<MemberCode>
  implements IMemberCodeRepository
{
  async byCode(code: string) {
    return this.findOne((user) => user.code === code);
  }
}
