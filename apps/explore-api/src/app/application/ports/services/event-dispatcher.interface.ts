import { IEvent } from '../../../libs/shared/event.js';

export const I_EVENT_DISPATCHER = Symbol('I_EVENT_DISPATCHER');

export interface IListener {
  (event: IEvent): Promise<void>;
}

export interface IEventDispatcher {
  raise(event: IEvent): Promise<void>;

  on(event: IEvent, callback: IListener): void;

  raiseAll(events: IEvent[]): Promise<void>;
}
