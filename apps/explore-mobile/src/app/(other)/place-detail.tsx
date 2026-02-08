import { PlaceDetailScreen } from '@/screens/places/place-detail/PlaceDetailScreen'
import { useLocalSearchParams } from 'expo-router'

export default function Page() {
  const params = useLocalSearchParams<{ placeId: string }>()

  return <PlaceDetailScreen placeId={params.placeId} />
}
