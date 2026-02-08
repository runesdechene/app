import { useSession } from '@/hooks/use-session'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { Accessibility, ApiPlaceType } from '@model'
import {
  Avatar,
  AvatarLink,
  Button,
  ButtonColors,
  ButtonPictoType,
  Colors,
  Flex,
  GapSeparator,
  IconContainer,
  IconType,
  ImagesCarousel,
  MapViewWrapper,
  PlaceTypeIconContainer,
  Sizes,
  Text,
  Title,
} from '@ui'
import * as ExpoLinking from 'expo-linking'
import { useEffect } from 'react'
import { StyleProp, View, ViewStyle } from 'react-native'
import { ReviewsSection } from './components/ReviewsSection'
import { usePlaceDetailPresenter } from './hooks/use-place-detail-presenter'

const Meta = ({
  text,
  iconName,
  style,
}: {
  text: string
  iconName: IconType
  style?: StyleProp<ViewStyle>
}) => (
  <Flex direction="row" gap="M" style={style}>
    <IconContainer name={iconName} color={Colors.text} size="M" />
    <Text width="100%">{text}</Text>
  </Flex>
)
export const PlaceDetailPage = ({
  placeId,
  placeTypes,
}: {
  placeId: string
  placeTypes: ApiPlaceType[]
}) => {
  const MAX_EXPLORERS_TO_DISPLAY = 2
  const {
    place,
    like,
    removeLike,
    explore,
    removeExplore,
    bookmark,
    removeBookmark,
    onOptionsClick,
    onProfileClick,
  } = usePlaceDetailPresenter({ placeId })
  const { isAuthenticated } = useSession()
  const { placesCommandGateway, router } = useDependencies()

  const goToExplorer = (explorerId: string) =>
    router.push(`/(other)/user-profile?userId=${explorerId}`)

  const getAccessibilityFrench = (accessibility: Accessibility) => {
    switch (accessibility) {
      case 'easy':
        return 'Facile'
      case 'medium':
        return 'Moyen'
      default:
        return 'Difficile'
    }
  }

  const categoryPlace = placeTypes.find(
    x => x.id === (place.type.parent ?? place.type.id),
  )
  useEffect(() => {
    try {
      placesCommandGateway.viewPlace(place.id)
    } catch (e) {
      // Who cares ?
    }
  }, [])

  const colorButton: ButtonColors = Colors.buttonPicto[
    categoryPlace!.images.local as any as ButtonPictoType
  ].color as any as ButtonColors

  return (
    <>
      <ImagesCarousel images={place.images} placeType={categoryPlace} />
      <Flex direction="row" gap="XL" style={{ alignItems: 'flex-start' }}>
        <Title size="h1" grow style={{ maxWidth: '80%' }}>
          {place.title}
        </Title>
        <Button
          iconName={!!place.requester?.bookmarked ? 'bookmarkFill' : 'bookmark'}
          active={!!place.requester?.bookmarked}
          onPress={!!place.requester?.bookmarked ? removeBookmark : bookmark}
          noBorder
          size="L"
          fullWidth={false}
          color="invisible"
          iconOnly
        />
        <Button
          iconName={'threeDot'}
          onPress={onOptionsClick}
          noBorder
          size="L"
          fullWidth={false}
          color="invisible"
          iconOnly
        />
      </Flex>
      <Flex direction="row" gap="S">
        <PlaceTypeIconContainer
          placeTypeName={place.type.images.local}
          placeTypeSize="map_mini"
          size="M"
        />
        <Title size="h3">{place.type.title}</Title>
        {place.metrics.note && (
          <>
            <IconContainer name="star" size="M" color={Colors.label} />
            <Text>{place.metrics.note.toFixed(1)}</Text>
          </>
        )}
      </Flex>
      {isAuthenticated && (
        <Flex direction="row" gap="M">
          <Button
            iconName="compass"
            active={!!place.requester?.explored}
            onPress={!!place.requester?.explored ? removeExplore : explore}
            color={colorButton}
            size="M"
            fullWidth={false}
            style={{ width: '80%' }}
          >
            {!!place.requester?.explored
              ? "J'y suis allé !"
              : "Je n'y suis pas allé"}
          </Button>
          <Button
            iconName={!!place.requester?.liked ? 'heartFill' : 'heart'}
            active={!!place.requester?.liked}
            onPress={!!place.requester?.liked ? removeLike : like}
            color={colorButton}
            fullWidth={false}
            style={{ width: '20%' }}
          />
        </Flex>
      )}
      <Flex direction="row" gap="M">
        <Meta
          iconName="eye"
          text={`${place.metrics.views.toString()} ${place.metrics.views > 1 ? 'vues' : 'vue'}`}
          style={{ maxWidth: '33%' }}
        />
        <Meta
          iconName="heart"
          text={`${place.metrics.likes.toString()} ${place.metrics.likes > 1 ? "j'aimes" : "j'aime"}`}
          style={{ maxWidth: '33%' }}
        />
        {place.accessibility && (
          <Meta
            iconName={place.accessibility}
            text={getAccessibilityFrench(place.accessibility)}
            style={{ maxWidth: '33%' }}
          />
        )}
      </Flex>
      {place.geocaching && (
        <Flex direction="row" gap="M">
          <Meta iconName="rune" text={"Présence d'une Géocache"} />
        </Flex>
      )}
      <Flex direction="row" gap="M">
        <AvatarLink
          onPress={() => isAuthenticated && onProfileClick()}
          size="S"
          key={place.author.id}
          url={place.author.profileImageUrl}
          text={place.author.lastName[0]?.toUpperCase()}
        />
        <PlaceTypeIconContainer
          placeTypeName={'flag'}
          placeTypeSize={'main'}
          size="L"
          style={{
            position: 'absolute',
            top: Sizes.icon.S,
            left: Sizes.icon.S,
          }}
        />
        {(place.lastExplorers ?? [])
          .slice(0, MAX_EXPLORERS_TO_DISPLAY)
          .map(explorer => (
            <AvatarLink
              onPress={() => isAuthenticated && goToExplorer(explorer.id)}
              size="S"
              key={explorer.id}
              url={explorer.profileImageUrl}
              text={explorer.lastName[0]?.toUpperCase()}
            />
          ))}
        {place.metrics.explored - 1 > MAX_EXPLORERS_TO_DISPLAY && (
          <Avatar
            text={
              '+' +
              (
                place.metrics.explored -
                1 - // Remove author of place
                MAX_EXPLORERS_TO_DISPLAY
              ).toString()
            }
            size="S"
          />
        )}
        {place.metrics.explored > 0 && <Text>l'ont arpentés</Text>}
      </Flex>
      {place.sensible && (
        <>
          <GapSeparator />
          <Button
            iconName="alert"
            onPress={() => router.push('/settings/sensible-place')}
            color="default"
            active
          >
            Lieu sensible
          </Button>
        </>
      )}
      <GapSeparator />
      <Flex direction="row" gap="M" style={{ alignItems: 'baseline' }}>
        <Title size="h2">A propos</Title>
        <Title size="h3" color={Colors.label}>
          Ajouté par {place.author.lastName}
        </Title>
      </Flex>
      <Text>{place.text}</Text>
      {categoryPlace?.hidden && (
        <>
          <GapSeparator />
          <Flex direction="row" gap="M" style={{ alignItems: 'baseline' }}>
            <Title size="h2">Evênement temporaire</Title>
          </Flex>
          <Text>
            Du{' '}
            {!place.beginAt || place.beginAt === null
              ? 'INDEFINI'
              : new Date(place.beginAt).toLocaleDateString()}{' '}
            au{' '}
            {!place.endAt || place.endAt === null
              ? 'INDEFINI'
              : new Date(place.endAt).toLocaleDateString()}
          </Text>
        </>
      )}
      <View style={{ borderRadius: 20, overflow: 'hidden' }}>
        <MapViewWrapper
          style={{
            height: 200,
            borderRadius: 12,
          }}
          initialRegion={{
            latitude: place.location.latitude,
            longitude: place.location.longitude,
            latitudeDelta: 0.0722,
            longitudeDelta: 0.0221,
          }}
          listMarker={[
            {
              id: `place_detail_${place.id}`,
              location: {
                latitude: place.location.latitude,
                longitude: place.location.longitude,
              },
              title: place.title,
              iconName: place.type.images.local,
            },
          ]}
        />
      </View>
      <Button
        iconName="mapPin"
        onPress={() => {
          ExpoLinking.openURL(
            `https://www.google.com/maps/search/?api=1&query=${place.location.latitude},${place.location.longitude}`,
          )
        }}
        size="S"
      >
        Se rendre sur ce lieu
      </Button>
      <GapSeparator separator />
      <ReviewsSection placeId={placeId} />
    </>
  )
}
