import { Entity, ManyToOne, Property, Ref } from '@mikro-orm/core';
import { SqlEntity } from '../../../adapters/for-production/database/sql-entity.js';
import { User } from './user.js';
import { IDateProvider } from '../../application/ports/services/date-provider.interface.js';
import { Token } from '../model/token.js';

type Props = {
  id: string;
  user: User;
  value: string;
  expiresAt: Date;
  disabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

@Entity({ tableName: 'refresh_tokens' })
export class RefreshToken extends SqlEntity<Props> {
  @ManyToOne({
    entity: () => User,
    index: true,
    ref: true,
    deleteRule: 'cascade',
  })
  user!: Ref<User>;

  @Property({ unique: true })
  value: string;

  @Property()
  expiresAt: Date;

  @Property()
  disabled: boolean;

  hasExpired(dateProvider: IDateProvider) {
    return this.expiresAt.getTime() < dateProvider.now().getTime();
  }

  asToken(): Token {
    return new Token(this.createdAt, this.expiresAt, this.value);
  }
}
