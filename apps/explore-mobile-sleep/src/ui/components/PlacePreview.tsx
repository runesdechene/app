import { Colors, Opacity, Radius } from '@/ui/constants'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import {
  Flex,
  GapSeparator,
  IconContainer,
  PlaceTypeIconContainer,
  Text,
  Title,
} from '@/ui/libs'
import { calculateDistance } from '@/utils/geoloc-utils'
import { ApiPlaceSummary } from '@model'
import { useMemo, useState } from 'react'
import { Pressable } from 'react-native'
import styled from 'styled-components/native'
import { useLocationProvider } from './LocationProvider'

export const PlacePreview = ({
  place,
  index,
}: {
  place: ApiPlaceSummary
  index: number
}) => {
  const { router } = useDependencies()
  const { location } = useLocationProvider()
  const [distance, setDistance] = useState<number | undefined>()

  useMemo(() => {
    if (location) {
      const currentDistance = calculateDistance(
        location.latitude,
        location.longitude,
        place.location.latitude,
        place.location.longitude,
      )
      if (currentDistance !== distance) {
        setDistance(currentDistance)
      }
    }
  }, [location, place.location.latitude, place.location.longitude])

  return (
    <>
      <Pressable
        onPress={() => router.push(`/(other)/place-detail?placeId=${place.id}`)}
        style={{
          flexGrow: 1,
          flexBasis: 0,
          flexShrink: 1,
        }}
      >
        <Flex gap="NONE">
          <Image
            source={
              place.imageUrl
                ? {
                    uri: place.imageUrl,
                  }
                : undefined
            }
            style={{ width: '100%' }}
            resizeMode="cover"
          />
          {/** allow us to have a small gap between the photo and the title */}
          <Flex gap="S">
            <GapSeparator />
            <Title size="h3">{place.title}</Title>
          </Flex>
          <Flex direction="row" gap="S">
            <PlaceTypeIconContainer
              placeTypeName={place.type.images.local}
              placeTypeSize="map_mini"
              size="M"
            />
            {distance && (
              <Text size="S" align="start">
                à {distance?.toFixed(2)}km
              </Text>
            )}
            {place.avg_score && (
              <>
                <IconContainer name="star" color={Colors.yellow} size="M" />
                <Text size="S">{place.avg_score.toFixed(1)}</Text>
              </>
            )}
          </Flex>
        </Flex>
      </Pressable>
    </>
  )
}

const Image = styled.Image`
  height: 230px;
  border-radius: ${Radius.default}px;
  opacity: ${Opacity.blurry};
`
