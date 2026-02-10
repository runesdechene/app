import { useAdminRootPlaceTypesQuery } from '@/queries/use-admin-root-place-types-query'
import { usePlaceDetailQuery } from '@/queries/use-place-detail-query'
import { useRootPlaceTypesQuery } from '@/queries/use-root-place-types-query'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { ErrorScreen, LoadingScreen, Screen } from '@ui'
import { PlaceDetailPage } from './PlaceDetailPage'

export const PlaceDetailScreen = ({ placeId }: { placeId: string }) => {
  const queryPlace = usePlaceDetailQuery({ placeId })
  const queryPlaceTypes = useRootPlaceTypesQuery()
  const queryAdminPlaceTypes = useAdminRootPlaceTypesQuery()
  const { router } = useDependencies()

  if (
    queryPlace.isLoading ||
    queryPlaceTypes.isLoading ||
    queryAdminPlaceTypes.isLoading
  ) {
    return <LoadingScreen />
  }
  if (queryPlace.isError) {
    return <ErrorScreen>{queryPlace.error}</ErrorScreen>
  }
  if (queryPlaceTypes.isError) {
    return <ErrorScreen>{queryPlaceTypes.error}</ErrorScreen>
  }

  return (
    <Screen
      backButton={{
        label: 'back',
        onBackButton: () => router.back(),
        floatingMode: true,
      }}
    >
      <PlaceDetailPage
        placeId={queryPlace.data!.id}
        placeTypes={[
          ...(queryPlaceTypes.data ?? []),
          ...(queryAdminPlaceTypes.data ?? []),
        ]}
      />
    </Screen>
  )
}
