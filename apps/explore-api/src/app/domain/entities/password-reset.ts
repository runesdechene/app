import { Entity, ManyToOne, Property, Ref } from '@mikro-orm/core';
import { SqlEntity } from '../../../adapters/for-production/database/sql-entity.js';
import { User } from './user.js';
import { IDateProvider } from '../../application/ports/services/date-provider.interface.js';

type Props = {
  id: string;
  user: User;
  code: string;
  expiresAt: Date;
  isConsumed: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

@Entity({ tableName: 'password_resets' })
export class PasswordReset extends SqlEntity<Props> {
  @ManyToOne({
    entity: () => User,
    index: true,
    ref: true,
    deleteRule: 'cascade',
  })
  user!: Ref<User>;

  @Property()
  code: string;

  @Property()
  expiresAt: Date;

  @Property()
  isConsumed: boolean;

  consume() {
    this.isConsumed = true;
  }

  hasExpired(dateProvider: IDateProvider) {
    return dateProvider.now() > this.expiresAt;
  }
}
