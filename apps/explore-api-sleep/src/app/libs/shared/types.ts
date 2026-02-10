export type Nullable<T> = T | null;
export type PartialRecord<K extends keyof any, T> = {
  [P in K]?: T;
};
