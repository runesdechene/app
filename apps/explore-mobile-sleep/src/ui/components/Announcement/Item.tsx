import { Spacing } from '@/ui/constants'
import { Button, Flex, Text, Title } from '@/ui/libs'
import React from 'react'
import { Image } from 'react-native'
import { Feature } from './Announcement'

type Props = {
  item: Feature
  isLastIndex: boolean
  slideToNextItem: () => void
  announcementWidth: number
}

const Item = ({
  item,
  isLastIndex,
  slideToNextItem,
  announcementWidth,
}: Props) => {
  const continueTitle = 'Suivant'
  const lastIndexTitle = 'Explorer'

  return (
    <Flex
      style={[
        {
          width: announcementWidth,
          paddingLeft: Spacing.padding.screen,
          paddingRight: Spacing.padding.screen,
        },
      ]}
      center
      gap="M"
    >
      <Image
        resizeMode={'contain'}
        source={item.image}
        style={{ maxHeight: '70%', maxWidth: announcementWidth }}
      />
      <Title size="h2">{item.title}</Title>
      {item.description && <Text align="center">{item.description}</Text>}
      <Button color="primary" onPress={slideToNextItem} size="S">
        {isLastIndex ? lastIndexTitle : continueTitle}
      </Button>
    </Flex>
  )
}
export default Item
