import { Optional } from '../../../app/libs/shared/optional.js';
import { SqlEntity } from '../../for-production/database/sql-entity.js';

export abstract class BaseRamRepository<T extends SqlEntity<any>> {
  protected database: Record<string, T> = {};

  constructor(entities: T[] = []) {
    entities.forEach((lesson) => {
      this.database[lesson.id] = lesson;
    });
  }

  async byId(id: string): Promise<Optional<T>> {
    return this.byIdSync(id);
  }

  async clear(): Promise<void> {
    this.clearSync();
  }

  async delete(entity: T): Promise<void> {
    delete this.database[entity.id];
  }

  async save(entity: T): Promise<void> {
    this.database[entity.id] = entity;
  }

  clearSync(): void {
    this.database = {};
  }

  byIdSync(id: string): Optional<T> {
    return Optional.of<T>(this.database[id]?.clone() ?? null);
  }

  find(predicate: (entity: T) => boolean): T[] {
    return Object.values(this.database)
      .filter(predicate)
      .map((entity) => entity.clone());
  }

  findOne(predicate: (entity: T) => boolean): Optional<T> {
    const value = Object.values(this.database).find(predicate);
    return value
      ? Optional.of(value.clone())
      : (Optional.of(null) as unknown as Optional<T>);
  }

  reset(entities: T[]): void {
    this.clearSync();
    entities.forEach((entity) => this.save(entity));
  }
}
