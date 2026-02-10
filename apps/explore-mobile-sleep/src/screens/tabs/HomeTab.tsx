import { useBannerFeedQuery } from '@/queries/use-banner-feed-query'
import { useRegularFeedQuery } from '@/queries/use-regular-feed-query'
import { APP_VERSION } from '@/shared/version'
import { ApiPlaceSummary } from '@model'
import { GetRegularFeedType } from '@ports'
import {
  Banner,
  Colors,
  FixedScreen,
  FlatListWrapper,
  PlacePreview,
  Tabs,
  Text,
  useLocationProvider,
} from '@ui'
import { useEffect } from 'react'

export const HomeTab = () => {
  const bannerQuery = useBannerFeedQuery({ type: 'latest' })

  return (
    <FixedScreen avatarHeader footer={{ sticky: true }}>
      <Text color={Colors.label} style={{ textAlign: 'center', opacity: 0.5, fontSize: 11, marginTop: -8, marginBottom: -8 }}>
        v{APP_VERSION}
      </Text>
      <Banner data={bannerQuery.data?.[0]} />
      <Tabs
        tabs={[
          {
            key: 'latest',
            name: 'Récents',
            content: <PlacesSubTab type={'latest'} />,
            iconName: 'starMany',
          },
          {
            key: 'closest',
            name: 'Proches',
            content: <PlacesSubTab type={'closest'} />,
            iconName: 'pin',
          },
          {
            key: 'popular',
            name: 'Populaires',
            content: <PlacesSubTab type={'popular'} />,
            iconName: 'flame',
          },
        ]}
      />
    </FixedScreen>
  )
}

const PlacesSubTab = ({ type }: { type: GetRegularFeedType }) => {
  const getParams = (type: GetRegularFeedType) => {
    switch (type) {
      case 'popular':
        return { type: 'popular' }
      case 'closest':
        return {
          type: 'closest',
          location,
        }
      default:
        return { type: 'latest' }
    }
  }

  const { location, locationService } = useLocationProvider()
  const query = useRegularFeedQuery(getParams(type) as any)

  useEffect(() => {
    if (type === 'closest') {
      locationService.acquireLocation()
    }
  }, [type])

  return (
    <FlatListWrapper
      query={query}
      itemRender={(item: ApiPlaceSummary, index: number) => {
        return <PlacePreview place={item} index={index} />
      }}
    />
  )
}
