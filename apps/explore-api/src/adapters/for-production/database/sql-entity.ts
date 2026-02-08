import { PrimaryKey, Property } from '@mikro-orm/core';
import { RandomIdProvider } from '../services/random-id-provider.js';
import { SystemDateProvider } from '../services/system-date-provider.js';

export abstract class SqlEntity<
  TProps extends {
    id: string;
    createdAt?: Date;
    updatedAt?: Date;
  },
> {
  @PrimaryKey({ unique: true })
  id: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(props?: Partial<TProps>) {
    if (props) {
      this.id = props.id ?? RandomIdProvider.getId();
      this.createdAt = props.createdAt ?? SystemDateProvider.now();
      this.updatedAt = props.updatedAt ?? SystemDateProvider.now();
    }
  }

  clone(): this {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
  }
}
