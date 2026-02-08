import { EventEmitter2 } from '@nestjs/event-emitter';
import { IEventDispatcher } from '../../../app/application/ports/services/event-dispatcher.interface.js';
import { IEvent } from '../../../app/libs/shared/event.js';

export class SystemEventDispatcher implements IEventDispatcher {
  constructor(private eventEmitter: EventEmitter2) {}

  async raise(event: IEvent): Promise<void> {
    this.eventEmitter.emit(event.getName(), event);
  }

  on(event: IEvent, callback: (event: IEvent) => Promise<void>): void {
    this.eventEmitter.on(event.getName(), callback);
  }

  async raiseAll(events: IEvent[]): Promise<void> {
    await Promise.all(events.map((event) => this.raise(event)));
  }
}
