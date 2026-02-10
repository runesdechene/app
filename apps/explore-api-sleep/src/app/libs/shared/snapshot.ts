export interface ISnapshottable<TSnapshot> {
  snapshot(): TSnapshot;
}

export type GetSnapshot<T> =
  T extends ISnapshottable<infer TSnapshot> ? TSnapshot : never;
