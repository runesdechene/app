import { User } from '../../../../app/domain/entities/user.js';
import { Role } from '../../../../app/domain/model/role.js';
import { IUserRepository } from '../../../../app/application/ports/repositories/user-repository.js';
import { Optional } from '../../../../app/libs/shared/optional.js';
import { BaseSqlRepository } from '../base-sql-repository.js';

export class SqlUserRepository
  extends BaseSqlRepository<User>
  implements IUserRepository
{
  async findAdmins() {
    return this.repository.find({ role: Role.ADMIN });
  }

  async byEmailAddress(emailAddress: string) {
    const result = await this.repository.findOne({ emailAddress });
    return result ? Optional.of(result) : Optional.of(null as any);
  }
}
