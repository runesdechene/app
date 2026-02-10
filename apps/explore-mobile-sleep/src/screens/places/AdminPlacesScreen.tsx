import { useBannerFeedQuery } from '@/queries/use-banner-feed-query'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { ApiPlaceSummary } from '@model'
import { FixedScreen, FlatListWrapper, PlacePreview, Tabs } from '@ui'

export const AdminPlacesScreen = () => {
  const { router } = useDependencies()

  return (
    <FixedScreen
      backButton={{
        label: 'Listes admin',
        onBackButton: () => router.back(),
      }}
      footer={{ sticky: true }}
    >
      <Tabs
        tabs={[
          {
            key: 'events',
            name: 'Evênements',
            content: <PlacesSubTab />,
            iconName: 'starMany',
          },
        ]}
      />
    </FixedScreen>
  )
}

const PlacesSubTab = () => {
  const query = useBannerFeedQuery({ type: 'all' })

  return (
    <FlatListWrapper
      query={query}
      itemRender={(item: ApiPlaceSummary, index: number) => {
        return <PlacePreview place={item} index={index} />
      }}
    />
  )
}
