import { EntityName, MikroORM } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { User } from '../../../app/domain/entities/user.js';
import { MemberCode } from '../../../app/domain/entities/member-code.js';
import { Place } from '../../../app/domain/entities/place.js';
import { PlaceType } from '../../../app/domain/entities/place-type.js';
import { allEntities } from './all-entities.js';

export class MikroOrmProvider {
  constructor(private orm: MikroORM) {}

  static create() {
    const orm = MikroORM.initSync({
      connect: false,
      clientUrl: 'postgresql://user:password123@localhost:7654/user',
      entities: allEntities,
      metadataProvider: TsMorphMetadataProvider,
      dynamicImportProvider: (id) => import(id),
    });

    return new MikroOrmProvider(orm);
  }

  async init() {
    await this.orm.getSchemaGenerator().refreshDatabase();
  }

  entityManager() {
    return this.orm.em;
  }

  repository<T extends {}>(name: EntityName<T>) {
    return this.orm.em.getRepository(name);
  }

  async flush() {
    await this.orm.em.flush();
    this.orm.em.clear();
  }

  async truncate() {
    await this.orm.em.nativeDelete(User, {});
    await this.orm.em.nativeDelete(MemberCode, {});
    await this.orm.em.nativeDelete(Place, {});
    await this.orm.em.nativeDelete(PlaceType, {});
  }
}
