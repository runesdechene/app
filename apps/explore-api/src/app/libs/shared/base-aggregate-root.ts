import { BaseEntity } from './base-entity.js';

export abstract class BaseAggregateRoot<
  TState extends { id: string },
  TSnapshot = TState,
> extends BaseEntity<TState, TSnapshot> {}
