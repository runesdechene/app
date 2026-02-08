import { Entity, ManyToOne, Property, Ref } from '@mikro-orm/core';
import { SqlEntity } from '../../../adapters/for-production/database/sql-entity.js';
import { Place } from './place.js';
import { User } from './user.js';

type Props = {
  id: string;
  user: Ref<User>;
  place: Ref<Place>;
  createdAt?: Date;
  updatedAt?: Date;
};

@Entity({ tableName: 'places_viewed' })
export class PlaceViewed extends SqlEntity<Props> {
  @Property({ primary: true })
  id: string;

  @ManyToOne({
    entity: () => User,
    index: true,
    ref: true,
    deleteRule: 'cascade',
  })
  user!: Ref<User>;

  @ManyToOne({
    entity: () => Place,
    index: true,
    ref: true,
    deleteRule: 'cascade',
  })
  place!: Ref<Place>;

  constructor(props?: Props) {
    super(props);
    Object.assign(this, props ?? {});
  }
}
