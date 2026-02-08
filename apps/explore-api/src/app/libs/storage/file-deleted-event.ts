import { Storable } from './storable.js';
import { IEvent } from '../shared/event.js';

export class FileDeletedEvent implements IEvent {
  static eventName = 'file-deleted';

  constructor(public file: Storable) {}

  getName(): string {
    return FileDeletedEvent.eventName;
  }
}
