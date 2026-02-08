import { useRef } from 'react'
import { useLocationProvider } from './LocationProvider'

/**
 * When mounted, this component will kickstart the geolocation process
 * It will fetch the initial location of the user and monitor it in a safe &
 * battery efficient manner.
 * @constructor
 */
export const LocationStarter = () => {
  const { locationService } = useLocationProvider()
  const initialized = useRef(false)

  if (!initialized.current) {
    initialized.current = true
    locationService.initialize()
    locationService.watch()
  }

  return null
}
