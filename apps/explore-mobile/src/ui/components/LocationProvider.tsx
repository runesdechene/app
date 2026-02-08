import { Nullable } from '@/shared/types'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { DeviceLocationType, LocationService } from '@services'
import { createContext, useContext, useEffect, useState } from 'react'

type API = {
  locationService: LocationService
  location: Nullable<DeviceLocationType>
}

const Context = createContext<API>({
  locationService: null as any,
  location: null,
})

export const LocationProvider = ({ children }: { children: any }) => {
  const { locationService } = useDependencies()
  const [location, setLocation] = useState<Nullable<DeviceLocationType>>(null)

  useEffect(() => {
    return locationService.addListener(setLocation)
  }, [])

  const api: API = {
    locationService: locationService,
    location,
  }

  return <Context.Provider value={api}>{children}</Context.Provider>
}

export const useLocationProvider = () => useContext(Context)
