import { IEventDispatcher } from '../../../app/application/ports/services/event-dispatcher.interface.js';
import { IEvent } from '../../../app/libs/shared/event.js';

export class InMemoryEventDispatcher implements IEventDispatcher {
  public events: IEvent[] = [];

  async raise(event: IEvent): Promise<void> {
    this.events.push(event);
  }

  on(event: IEvent, callback: (event: IEvent) => Promise<void>): void {}

  async raiseAll(events: IEvent[]): Promise<void> {
    this.events.push(...events);
  }

  clear() {
    this.events = [];
  }
}
