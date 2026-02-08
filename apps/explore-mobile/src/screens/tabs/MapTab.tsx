import { useSession } from '@/hooks/use-session'
import { useMapBannersQuery } from '@/queries/use-map-banner-query'
import { useMapPlacesQuery } from '@/queries/use-map-places-query'
import { Nullable } from '@/shared/types'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { ApiPlaceMap } from '@model'
import { DeviceLocationType } from '@services'
import {
  AvatarHeader,
  Colors,
  FixedScreen,
  Loader,
  LoadingScreen,
  MapMarkerProps,
  MapViewWrapper,
  ScreenReductor,
} from '@ui'
import * as ExpoLinking from 'expo-linking'
import { useEffect, useMemo, useState } from 'react'
import { Region } from 'react-native-maps'
import styled from 'styled-components/native'

export const MapTab = () => {
  const { router, locationService } = useDependencies()
  const { session } = useSession()
  const [location, setLocation] = useState<Nullable<DeviceLocationType>>()
  const [region, setRegion] = useState<Region>()
  const [places, setPlaces] = useState<ApiPlaceMap[]>([])
  const [banners, setBanners] = useState<ApiPlaceMap[]>([])
  const query = useMapPlacesQuery({
    onSuccess: data => {
      setPlaces(data as ApiPlaceMap[])
    },
  })

  const queryBanner = useMapBannersQuery({
    onSuccess: data => {
      setBanners(data as ApiPlaceMap[])
    },
  })

  useEffect(() => {
    if (!location) {
      locationService.acquireLocation().then(data => {
        setLocation(data)
        setRegion(data as Region)
      })
    }
  }, [locationService, location])

  useEffect(() => {
    if (region) {
      const zone = {
        latitude: region.latitude,
        longitude: region.longitude,
        latitudeDelta: region?.latitudeDelta ?? 0.8,
        longitudeDelta: region?.longitudeDelta ?? 0.8,
      }
      query.mutateAsync(zone)
      queryBanner.mutateAsync(zone)
    }
  }, [region])

  const placesToDisplay = useMemo(() => {
    let listPlaces: MapMarkerProps[] = []

    if (places.length > 0) {
      listPlaces = listPlaces.concat(
        places.map(place => {
          return {
            id: place.id,
            location: {
              latitude: place.location.latitude,
              longitude: place.location.longitude,
            },
            iconName: place.type.images?.local,
            onPress: () => {
              router.push(`/(other)/place-detail?placeId=${place.id}`)
            },
          } as MapMarkerProps
        }),
      )
    }
    if (banners.length > 0) {
      listPlaces = listPlaces.concat(
        banners.map(banner => {
          return {
            id: banner.id,
            location: {
              latitude: banner.location.latitude,
              longitude: banner.location.longitude,
            },
            iconName: 'stand',
            onPress: () => {
              if (banner?.url) {
                ExpoLinking.openURL(banner.url)
              }
            },
            zIndex: 9999999,
          } as MapMarkerProps
        }),
      )
    }
    if (location) {
      listPlaces.push({
        id: 'current_position',
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        title: session?.user.lastName,
        iconName: 'flag',
        zIndex: 9999999,
      })
    }

    return listPlaces
  }, [places, banners, location])

  if (!location) {
    return <LoadingScreen />
  }

  return (
    <FixedScreen
      header={{ hideBackground: true, backgroundColor: Colors.superBackground }}
      footer={{ sticky: true }}
      preventPadding
    >
      <ScreenReductor>
        <AvatarHeader />
      </ScreenReductor>
      <MapViewWrapper
        initialRegion={
          location
            ? {
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: location?.latitudeDelta ?? 0.8,
                longitudeDelta: location?.longitudeDelta ?? 0.8,
              }
            : undefined
        }
        onRegionChange={region => {
          setRegion(region)
        }}
        listMarker={placesToDisplay}
      />

      {query.isPending && <Loader />}
      <Image source={require('@/ui/assets/images/gradient_map.png')} />
    </FixedScreen>
  )
}

export const Image = styled.Image`
  height: 50px;
  width: 100%;
  resize-mode: stretch;
  position: absolute;
  top: 90px;
`
