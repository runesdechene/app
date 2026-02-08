import {
  Collection,
  Entity,
  ManyToMany,
  ManyToOne,
  Property,
  Ref,
} from '@mikro-orm/core';
import { User } from './user.js';
import { SqlEntity } from '../../../adapters/for-production/database/sql-entity.js';
import { ImageMedia } from './image-media.js';
import { Place } from './place.js';

type Props = {
  id: string;
  user: Ref<User>;
  place: Ref<Place>;
  images: Collection<ImageMedia>;
  score: number;
  message: string;
  geocache: boolean;
};

@Entity({ tableName: 'reviews' })
export class Review extends SqlEntity<Props> {
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

  @ManyToMany({
    entity: () => ImageMedia,
    owner: true,
  })
  images = new Collection<ImageMedia>(this);

  @Property()
  score: number;

  @Property({ type: 'text' })
  message: string;

  @Property()
  geocache: boolean;

  constructor(props: Omit<Props, 'images'>) {
    super(props);
    this.id = props.id;
    this.place = props.place;
    this.user = props.user;
    this.score = props.score;
    this.message = props.message;
    this.images = new Collection<ImageMedia>(this);
    this.geocache = props.geocache;
  }
}
