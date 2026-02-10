import { distanceToNow } from '@/utils/date-utils'
import { ApiReview } from '@model'
import {
  Avatar,
  Button,
  Colors,
  Flex,
  IconContainer,
  ImagesList,
  rateArray,
  Tag,
  Text,
  Title,
} from '@ui'
import { Pressable } from 'react-native'
import { useReviewPresenter } from '../hooks/use-review-presenter'

export const Review = (props: {
  review: ApiReview
  isOwner: boolean
  placeId: string
  onClick: () => void
}) => {
  const { review, onClick } = props
  const presenter = useReviewPresenter(props)

  return (
    <Flex>
      <Pressable onPress={onClick}>
        <Flex
          direction="row"
          gap="XL"
          style={{ justifyContent: 'space-between' }}
        >
          <Flex direction="row" gap="XL" style={{ flexGrow: 1 }}>
            <Avatar
              text={review.user.lastName[0]?.toUpperCase()}
              size="S"
              url={review.user.profileImageUrl}
            />

            <Flex direction="row" gap="NONE" style={{ alignItems: 'baseline' }}>
              <Title size="h3">{review.user.lastName}, </Title>
              <Title size="h4" color={Colors.label}>
                il y a {distanceToNow(new Date(review.createdAt))}
              </Title>
            </Flex>
          </Flex>
          <Flex direction="row" gap="NONE">
            {!!review.geocache && <Tag color="purple">Géocache trouvée</Tag>}
            <Button
              size="S"
              onPress={presenter.onOptionsClick}
              color="invisible"
              fullWidth={false}
              iconName="threeDot"
            />
          </Flex>
        </Flex>
      </Pressable>
      <Text>{review.message}</Text>
      <Flex direction="row" gap="M">
        {rateArray.map(rate => {
          const isHighlighted = review.score >= rate
          if (isHighlighted) {
            return (
              <IconContainer
                key={rate}
                name={'starFill'}
                color={Colors.yellow}
                size="M"
              />
            )
          }
          return <IconContainer key={rate} name={'star'} size="M" />
        })}
      </Flex>
      {review.images.length > 0 && (
        <ImagesList
          images={review.images.map(img => ({
            id: img.id,
            url: img.largeUrl,
            status: 'uploaded',
          }))}
        />
      )}
    </Flex>
  )
}
