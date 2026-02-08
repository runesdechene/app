import { PlaceFormScreen } from '@/screens/places/place-form/PlaceFormScreen'
import { useLocalSearchParams } from 'expo-router'

export default function Page() {
  const params = useLocalSearchParams<{ placeTypeId: string }>()

  return <PlaceFormScreen type={'create'} placeTypeId={params.placeTypeId} />
}
