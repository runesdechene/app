import { useSession } from '@/hooks/use-session'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useQuery } from '@tanstack/react-query'
import { Button, Flex, Loader, Text, Title } from '@ui'
import { useFocusEffect } from 'expo-router'
import { Review } from './PlaceReview'

export const ReviewsSection = ({ placeId }: { placeId: string }) => {
  const { router, reviewsGateway } = useDependencies()
  const goToAddReview = () => router.push(`/add-review?placeId=${placeId}`)
  const goToReviewer = (authorId: string) =>
    router.push(`/(other)/user-profile?userId=${authorId}`)

  const { session } = useSession()

  useFocusEffect(() => {})

  const query = useQuery({
    queryKey: ['place', placeId, 'reviews'],
    queryFn: () => {
      return reviewsGateway.getPlaceReviews({
        params: {
          placeId,
        },
        count: 100,
      })
    },
  })

  return (
    <>
      <Flex
        direction="row"
        gap="XL"
        style={{ justifyContent: 'space-between' }}
      >
        <Title size="h2">Notre communauté en parle</Title>
        <Button
          type="round"
          onPress={goToAddReview}
          iconName="plus"
          size="S"
          fullWidth={false}
        />
      </Flex>
      {(query.data?.data ?? []).length === 0 && (
        <>
          {query.isLoading && <Loader />}
          {query.isLoading === false && (
            <Text>Soyez le premier à écrire un témoignage.</Text>
          )}
        </>
      )}
      {(query.data?.data ?? []).map(review => (
        <Review
          key={review.id}
          review={review}
          placeId={placeId}
          isOwner={session !== null && session.user.id === review.user.id}
          onClick={() => goToReviewer(review.user.id)}
        />
      ))}
    </>
  )
}
