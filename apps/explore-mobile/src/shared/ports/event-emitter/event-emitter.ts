type Subscription = {
  remove: () => void
}

export interface IEventEmitter {
  emit(name: string, payload: Record<string, any>): void
  on<T extends Record<string, any>>(
    name: string,
    listener: (payload: T) => void,
  ): Subscription
}
