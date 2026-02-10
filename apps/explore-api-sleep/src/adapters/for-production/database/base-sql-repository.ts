import { SqlEntity } from './sql-entity.js';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { Optional } from '../../../app/libs/shared/optional.js';

export abstract class BaseSqlRepository<TSql extends SqlEntity<any>> {
  constructor(
    protected readonly entityManager: EntityManager,
    protected readonly repository: EntityRepository<TSql>,
  ) {}

  async byId(id: string): Promise<Optional<TSql>> {
    const student = await this.repository.findOne({ id } as any);
    if (!student) {
      return Optional.of<TSql>(null);
    }

    return Optional.of<TSql>(student);
  }

  async save(entity: TSql): Promise<void> {
    this.entityManager.persist(entity);
  }

  async clear(): Promise<void> {
    await this.repository.nativeDelete({});
  }

  async delete(entity: TSql): Promise<void> {
    await this.repository.nativeDelete({ id: entity.id } as any);
  }
}
