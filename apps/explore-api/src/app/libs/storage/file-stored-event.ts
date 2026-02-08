import { Storable } from './storable.js';
import { IEvent } from '../shared/event.js';

export class FileStoredEvent implements IEvent {
  static eventName = 'file-stored';

  constructor(public file: Storable) {}

  getName(): string {
    return FileStoredEvent.eventName;
  }
}
