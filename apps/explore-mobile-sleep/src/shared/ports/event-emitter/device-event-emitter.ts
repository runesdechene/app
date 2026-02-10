import { IEventEmitter } from '@/shared/ports/event-emitter/event-emitter'
import { DeviceEventEmitter as Dee } from 'react-native'

export class DeviceEventEmitter implements IEventEmitter {
  emit(name: string, payload: Record<string, any>) {
    Dee.emit(name, payload)
  }

  on<T extends Record<string, any>>(
    name: string,
    listener: (payload: T) => void,
  ) {
    return Dee.addListener(name, listener)
  }
}
