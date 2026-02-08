import { ISnapshottable } from './snapshot.js';

export abstract class BaseEntity<
  TState extends { id: string },
  TSnapshot = TState,
> implements ISnapshottable<TSnapshot>
{
  protected readonly state: TState;

  constructor(
    state: TState,
    public readonly record: any = null,
  ) {
    this.state = { ...state };
  }

  getState() {
    return this.state;
  }

  mergeState(state: Partial<TState>) {
    Object.assign(this.state, state);
  }

  clone(): this {
    return new (this.constructor as any)(this.state);
  }

  abstract snapshot(): TSnapshot;

  getId() {
    return this.state.id;
  }
}

export type GetState<T> = T extends BaseEntity<infer U, unknown> ? U : never;
