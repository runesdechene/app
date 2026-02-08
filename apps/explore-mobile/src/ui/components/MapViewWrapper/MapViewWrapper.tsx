import { isDev } from '@/shared/api/environment'
import { CoordinatesType } from '@/ui/primitives'
import { PlaceIconType, placeTypeService } from '@services'
import React, { FC, memo } from 'react'
import { StyleProp, StyleSheet, ViewStyle } from 'react-native'
import MapView, {
  MapPressEvent,
  Marker,
  MarkerPressEvent,
  PROVIDER_GOOGLE,
  Region,
} from 'react-native-maps'
import styled from 'styled-components/native'
import { mapStyles } from './map-styles'

export type MapMarkerProps = {
  id: string
  location: CoordinatesType
  title?: string
  description?: string
  iconName?: PlaceIconType
  onPress?: (event: MarkerPressEvent) => void
  zIndex?: number
}

const MapMarker: FC<MapMarkerProps> = memo(
  ({ location, title, description, iconName, onPress, zIndex }) => {
    return (
      <ContainerMarker>
        <Marker
          coordinate={location}
          title={title}
          description={description}
          onPress={onPress}
          icon={iconName && placeTypeService.getImage(iconName, 'map_mini')}
          zIndex={zIndex}
        />
      </ContainerMarker>
    )
  },
)

type MapViewProps = {
  style?: StyleProp<ViewStyle>
  initialRegion?: Region
  onMapPress?: (event: MapPressEvent) => void
  onRegionChange?: (region: Region) => void
  listMarker: (MapMarkerProps | null)[]
}

export const MapViewWrapper = ({
  style,
  initialRegion,
  onRegionChange,
  onMapPress,
  listMarker,
}: MapViewProps) => {
  return (
    <MapView
      style={[styles.defaultStyle, style]}
      provider={isDev() ? undefined : PROVIDER_GOOGLE}
      customMapStyle={mapStyles}
      initialRegion={initialRegion}
      onRegionChangeComplete={region =>
        onRegionChange && onRegionChange(region)
      }
      onPress={onMapPress}
    >
      {listMarker
        .filter(x => !!x)
        .map(marker => {
          return <MapMarker key={marker.id} {...marker} />
        })}
    </MapView>
  )
}

const styles = StyleSheet.create({
  defaultStyle: {
    width: '100%',
    height: '100%',
  },
})

const ContainerMarker = styled.View`
  width: 10px;
  height: 10px;
`
