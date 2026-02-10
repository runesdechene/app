import { ReviewFormScreen } from '@/screens/places/review-form/ReviewFormScreen'
import { useLocalSearchParams } from 'expo-router'

export default function Page() {
  const params = useLocalSearchParams<{ placeId: string }>()

  return <ReviewFormScreen type={'create'} placeId={params.placeId} />
}
