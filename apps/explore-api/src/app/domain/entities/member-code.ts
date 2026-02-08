import { Entity, OneToOne, Property, ref, Ref } from '@mikro-orm/core';
import { SqlEntity } from '../../../adapters/for-production/database/sql-entity.js';
import { User } from './user.js';
import { Nullable } from '../../libs/shared/types.js';

type Props = {
  id: string;
  user: User;
  code: string;
  isConsumed: boolean;
};

@Entity({ tableName: 'member_codes' })
export class MemberCode extends SqlEntity<Props> {
  @OneToOne({
    entity: () => User,
    index: true,
    ref: true,
    deleteRule: 'set null',
    nullable: true,
  })
  user: Nullable<Ref<User>>;

  @Property({ unique: true, index: true })
  code: string;

  @Property()
  isConsumed: boolean;

  isConsumable() {
    return !this.isConsumed;
  }

  consume(userId: string) {
    this.user = ref(User, userId);
    this.isConsumed = true;
  }
}
