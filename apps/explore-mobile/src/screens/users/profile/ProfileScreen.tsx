import {
  UserPlacesFeedType,
  useUserPlacesFeedQuery,
} from '@/queries/use-user-places-feed-query'
import { ApiPlaceSummary, ApiUserProfile } from '@model'
import {
  FlatListWrapper,
  FlatListWrapperScreen,
  Flex,
  GapSeparator,
  PlacePreview,
  Spacing,
  Tabs,
} from '@ui'
import { useEffect, useState } from 'react'
import { UserDescription } from './UserDescription'

export const ProfileScreen = ({
  user,
}: {
  user: ApiUserProfile
  showHeader?: boolean
}) => {
  const [places, setPlaces] = useState<ApiPlaceSummary[]>([])
  const [key, setKey] = useState<UserPlacesFeedType>('added')
  const query = useUserPlacesFeedQuery({
    userId: user.id,
    type: key,
  })

  useEffect(() => {
    if (query.data?.pages) {
      const arr = query.data.pages.map(page => page.data).flat(1)
      setPlaces(arr)
    }
  }, [query.data])

  return (
    <FlatListWrapperScreen footer={{ sticky: true }}>
      <FlatListWrapper
        query={{
          ...query,
          data: places,
        }}
        paddingList
        itemRender={item => <PlacePreview place={item} />}
        containerStyle={{
          paddingLeft: Spacing.padding.screen,
          paddingRight: Spacing.padding.screen,
        }}
        listFooterComponent={
          <Flex gap="XL">
            <GapSeparator />
            <GapSeparator />
            <GapSeparator />
            <GapSeparator />
            <GapSeparator />
          </Flex>
        }
        listHeaderComponent={
          <Flex gap="XL">
            <UserDescription user={user} />
            <Tabs
              tabs={[
                {
                  key: 'added',
                  name: 'Ajoutés',
                  iconName: 'roundedPlus',
                  content: null,
                  onClick: () => {
                    setKey('added')
                  },
                },
                {
                  key: 'explored',
                  name: 'Arpentés',
                  iconName: 'tent',
                  content: null,
                  onClick: () => {
                    setKey('explored')
                  },
                },
                {
                  key: 'liked',
                  name: 'Enregistrés',
                  iconName: 'bookmark',
                  content: null,
                  onClick: () => {
                    setKey('bookmarked')
                  },
                },
              ]}
            />
          </Flex>
        }
      />
    </FlatListWrapperScreen>
  )
}
