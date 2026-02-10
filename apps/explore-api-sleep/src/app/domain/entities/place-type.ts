import { Entity, ManyToOne, Property, Ref } from '@mikro-orm/core';
import { SqlEntity } from '../../../adapters/for-production/database/sql-entity.js';
import { Nullable } from '../../libs/shared/types.js';

export type PlaceTypeImages = {
  background: string;
  regular: string;
  map: string;
  local?: string;
  localMini?: string;
};

type Props = {
  id: string;
  parent: Nullable<Ref<PlaceType>>;
  title: string;
  formDescription: string;
  longDescription: string;
  images: PlaceTypeImages;
  color: string;
  background: string;
  border: string;
  fadedColor: string;
  order: number;
  hidden: boolean;
};

@Entity({ tableName: 'place_types' })
export class PlaceType extends SqlEntity<Props> {
  @Property({ primary: true })
  id: string;

  @ManyToOne({
    entity: () => PlaceType,
    index: true,
    ref: true,
    deleteRule: 'cascade',
    nullable: true,
  })
  parent: Nullable<Ref<PlaceType>>;

  @Property()
  title: string;

  @Property()
  formDescription: string;

  @Property()
  longDescription: string;

  @Property({ type: 'json' })
  images: PlaceTypeImages;

  @Property()
  color: string;

  @Property()
  background: string;

  @Property()
  border: string;

  @Property({ name: 'faded_color' })
  fadedColor: string;

  @Property()
  order: number;

  @Property()
  hidden: boolean;

  constructor(props?: Props) {
    super(props);
    Object.assign(this, props ?? {});
  }
}
