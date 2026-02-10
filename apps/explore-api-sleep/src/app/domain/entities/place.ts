import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  Property,
  ref,
  Ref,
} from '@mikro-orm/core';
import { User } from './user.js';
import { SqlEntity } from '../../../adapters/for-production/database/sql-entity.js';
import { PlaceType } from './place-type.js';
import { PlaceViewed } from './place-viewed.js';
import { Nullable } from '../../libs/shared/types.js';

export const accessibilityKeys = ['easy', 'medium', 'hard'] as const;

export type Accessibility = (typeof accessibilityKeys)[number];

export type PlaceImage = {
  id: string;
  url: string;
};

type Props = {
  id: string;
  author: Ref<User>;
  placeType: Ref<PlaceType>;
  title: string;
  text: string;
  address: string;
  latitude: number;
  longitude: number;
  private: boolean;
  masked: boolean;
  images: PlaceImage[];
  createdAt?: Date;
  updatedAt?: Date;
  accessibility: Nullable<Accessibility>;
  sensible?: boolean;
  beginAt?: Date;
  endAt?: Date;
};

@Entity({ tableName: 'places' })
export class Place extends SqlEntity<Props> {
  @Property({ primary: true })
  id: string;

  @ManyToOne({
    entity: () => User,
    index: true,
    ref: true,
    deleteRule: 'cascade',
  })
  author!: Ref<User>;

  @ManyToOne({
    entity: () => PlaceType,
    index: true,
    ref: true,
    deleteRule: 'cascade',
  })
  placeType!: Ref<PlaceType>;

  @OneToMany({
    entity: () => PlaceViewed,
    mappedBy: 'place',
  })
  views!: Collection<PlaceViewed>;

  @Property()
  title: string;

  @Property({ type: 'text' })
  text: string;

  @Property()
  address: string;

  @Property({ type: 'float' })
  latitude: number;

  @Property({ type: 'float' })
  longitude: number;

  @Property()
  private: boolean;

  @Property()
  masked: boolean;

  @Property({ type: 'json' })
  images: PlaceImage[];

  @Property({ nullable: true })
  accessibility: Nullable<Accessibility>;

  @Property()
  sensible: boolean;

  @Property({ nullable: true, name: 'begin_at' })
  beginAt: Nullable<string>;

  @Property({ nullable: true, name: 'end_at' })
  endAt: Nullable<string>;

  constructor(props?: Props) {
    super(props);

    if (props) {
      this.id = props.id;
      this.author = props.author;
      this.placeType = props.placeType;
      this.title = props.title;
      this.text = props.text;
      this.address = props.address;
      this.latitude = props.latitude;
      this.longitude = props.longitude;
      this.private = props.private;
      this.masked = props.masked;
      this.images = props.images;
      this.accessibility = props.accessibility;
      this.sensible = props.sensible ?? false;
      this.endAt = null;
      this.beginAt = null;
    }
  }

  update(props: {
    placeTypeId: string;
    title: string;
    text: string;
    latitude: number;
    longitude: number;
    private: boolean;
    images: PlaceImage[];
    accessibility: Nullable<Accessibility>;
    sensible?: boolean;
    beginAt?: string | null;
    endAt?: string | null;
  }) {
    this.placeType = ref(PlaceType, props.placeTypeId);
    this.title = props.title;
    this.text = props.text;
    this.latitude = props.latitude;
    this.longitude = props.longitude;
    this.private = props.private;
    this.images = props.images;
    this.accessibility = props.accessibility;
    this.sensible = props.sensible ?? false;
    this.beginAt = props.beginAt ?? null;
    this.endAt = props.endAt ?? null;
  }
}
