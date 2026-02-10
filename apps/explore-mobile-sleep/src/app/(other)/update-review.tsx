import { ReviewFormScreen } from '@/screens/places/review-form/ReviewFormScreen'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useQuery } from '@tanstack/react-query'
import { ErrorScreen, LoadingScreen } from '@ui'
import { useLocalSearchParams } from 'expo-router'

export default function Page() {
  const params = useLocalSearchParams<{ reviewId: string; placeId: string }>()
  const { reviewsGateway } = useDependencies()

  const query = useQuery({
    queryKey: ['reviews', params.reviewId],
    queryFn: async () => reviewsGateway.getReviewById(params.reviewId),
  })

  if (query.isLoading) return <LoadingScreen />
  if (query.isError) return <ErrorScreen>{query.error}</ErrorScreen>

  return (
    <ReviewFormScreen
      type={'update'}
      review={query.data!}
      placeId={params.placeId}
    />
  )
}
