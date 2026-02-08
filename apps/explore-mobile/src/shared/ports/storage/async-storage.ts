import { IStorage } from '@/shared/ports/storage/storage'
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage'

export class AsyncStorage implements IStorage {
  getItem(key: string): Promise<string | null> {
    return ReactNativeAsyncStorage.getItem(key)
  }

  removeItem(key: string): Promise<void> {
    return ReactNativeAsyncStorage.removeItem(key)
  }

  setItem(key: string, value: string): Promise<void> {
    return ReactNativeAsyncStorage.setItem(key, value)
  }
}
