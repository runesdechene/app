import { ObservableValue } from '@/shared/lib/observable-value'
import { IAlerter } from '@/shared/ports/alerter/alerter'
import { Nullable } from '@/shared/types'
import * as ExpoLocation from 'expo-location'

export type DeviceLocationType = {
  latitude: number
  longitude: number
  latitudeDelta?: number
  longitudeDelta?: number
}

export class LocationService {
  private readonly location = new ObservableValue<Nullable<DeviceLocationType>>(
    null,
  )
  private subscription: ExpoLocation.LocationSubscription | null = null

  constructor(private readonly alerter: IAlerter) {}

  async initialize() {
    let { status } = await ExpoLocation.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      this.alerter.error('Permission to access location was denied')
      return
    }

    let location = await ExpoLocation.getCurrentPositionAsync({})
    this.location.set({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    })
  }

  async watch() {
    if (this.subscription) {
      return
    }

    let { status } = await ExpoLocation.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      this.alerter.error('Permission to access location was denied')
      return
    }

    this.subscription = await ExpoLocation.watchPositionAsync(
      {
        accuracy: ExpoLocation.LocationAccuracy.Balanced,
        timeInterval: 60000,
        distanceInterval: 10,
      },
      location => {
        this.location.set({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        })
      },
    )
  }

  async stopWatch() {
    if (this.subscription) {
      this.subscription.remove()
      this.subscription = null
    }
  }

  addListener(callback: (location: Nullable<DeviceLocationType>) => void) {
    return this.location.addListener(callback)
  }

  async acquireLocation() {
    if (this.location.get()) {
      return this.location.get()
    }

    let { status } = await ExpoLocation.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      this.alerter.error('Permission to access location was denied')
      return
    }

    let location = await ExpoLocation.getCurrentPositionAsync({})
    this.location.set({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    })

    return this.location.get()
  }
}
