import { usePlaceDetailQuery } from '@/queries/use-place-detail-query'
import { PlaceFormScreen } from '@/screens/places/place-form/PlaceFormScreen'
import { ErrorScreen, LoadingScreen } from '@ui'
import { useLocalSearchParams } from 'expo-router'

export default function Page() {
  const params = useLocalSearchParams<{ placeId: string }>()

  const query = usePlaceDetailQuery({ placeId: params.placeId })

  if (query.isLoading) return <LoadingScreen />
  if (query.isError) return <ErrorScreen>{query.error}</ErrorScreen>

  return <PlaceFormScreen type={'update'} place={query.data!} />
}
