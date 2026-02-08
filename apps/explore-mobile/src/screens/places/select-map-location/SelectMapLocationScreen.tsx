import { Nullable } from '@/shared/types'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import {
  Colors,
  FixedScreen,
  MapViewWrapper,
  Spacing,
  useLocationProvider,
} from '@ui'
import React, { useState } from 'react'

type SearchParams = {
  latitude: number
  longitude: number
}

type Props = {
  latitude: number
  longitude: number
  onBack: () => void
  onValidatePosition: (latitude: number, longitude: number) => void
}
export const SelectMapLocationScreen = ({
  latitude,
  longitude,
  onBack,
  onValidatePosition,
}: Props) => {
  const { location } = useLocationProvider()
  const { router, eventEmitter } = useDependencies()

  const initLocation =
    Boolean(latitude) && Boolean(longitude)
      ? {
          latitude: Number(Array.isArray(latitude) ? latitude[0] : latitude),
          longitude: Number(
            Array.isArray(longitude) ? longitude[0] : longitude,
          ),
        }
      : location
  const [marker, setMarker] = useState<Nullable<SearchParams>>(initLocation)

  return (
    <FixedScreen
      header={{ hideBackground: true, backgroundColor: Colors.superBackground }}
      footer={{ sticky: true }}
      preventPadding
      backButton={{
        label: 'Sélectionner un lieu',
        onBackButton: onBack,
      }}
      optionsButton={{
        buttonSize: 'S',
        buttonText: 'Terminer',
        buttonColor: 'primary',
        onOptionsButton: () => {
          onValidatePosition(marker!.latitude, marker!.longitude)
        },
        customStyle: {
          marginTop: Spacing.padding.M,
          marginRight: Spacing.padding.screen,
        },
      }}
    >
      <MapViewWrapper
        initialRegion={{
          latitude: initLocation?.latitude ?? 0,
          longitude: initLocation?.longitude ?? 0,
          latitudeDelta: 0.0722,
          longitudeDelta: 0.0221,
        }}
        listMarker={[
          marker
            ? {
                id: `select_map`,
                location: {
                  latitude: marker?.latitude,
                  longitude: marker?.longitude,
                },
                title: 'Lieu sélectionné',
              }
            : null,
        ]}
        onMapPress={e => {
          setMarker({
            latitude: e.nativeEvent.coordinate.latitude,
            longitude: e.nativeEvent.coordinate.longitude,
          })
        }}
      />
    </FixedScreen>
  )
}
