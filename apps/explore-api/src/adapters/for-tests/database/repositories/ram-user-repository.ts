import { IUserRepository } from '../../../../app/application/ports/repositories/user-repository.js';
import { Optional } from '../../../../app/libs/shared/optional.js';
import { User } from '../../../../app/domain/entities/user.js';
import { BaseRamRepository } from '../base-ram-repository.js';

export class RamUserRepository
  extends BaseRamRepository<User>
  implements IUserRepository
{
  async findAdmins(): Promise<User[]> {
    return this.find((user) => user.isAdmin());
  }

  async byEmailAddress(emailAddress: string): Promise<Optional<User>> {
    return this.findOne((user) => user.emailAddress === emailAddress);
  }
}
