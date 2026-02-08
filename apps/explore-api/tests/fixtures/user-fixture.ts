import { IFixture } from '../config/fixture.interface.js';
import { ITester } from '../config/tester.interface.js';
import {
  I_PASSWORD_STRATEGY,
  IPasswordStrategy,
} from '../../src/app/application/services/auth/password-strategy/password-strategy.interface.js';
import {
  I_USER_REPOSITORY,
  IUserRepository,
} from '../../src/app/application/ports/repositories/user-repository.js';
import { User } from '../../src/app/domain/entities/user.js';

export class UserFixture implements IFixture {
  constructor(protected readonly entity: User) {}

  async load(tester: ITester): Promise<void> {
    if (!this.entity.password) {
      throw new Error('Password is required');
    }

    const passwordStrategy = tester.get<IPasswordStrategy>(I_PASSWORD_STRATEGY);
    this.entity.password = await passwordStrategy.hash(this.entity.password);

    const repository = tester.get<IUserRepository>(I_USER_REPOSITORY);
    await repository.save(this.entity);
  }

  raw() {
    return this.entity;
  }

  id() {
    return this.entity.id;
  }

  emailAddress() {
    return this.entity.emailAddress;
  }
}
