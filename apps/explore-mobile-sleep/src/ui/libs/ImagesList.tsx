import { Colors, Radius, RadiusSizes, Spacing } from '@/ui/constants'
import React from 'react'
import { FlatList, ImageBackground } from 'react-native'
import styled from 'styled-components/native'
import { IconContainer, IconType } from './IconContainer'
import { Loader } from './Loader'

export type SelectedImage = {
  id: string
  url: string
  status: 'pending' | 'uploaded'
}

export const ImageListItem = ({
  image,
  actionButton,
  mode = 'default',
}: {
  image: SelectedImage
  mode?: RadiusSizes
  actionButton?: {
    iconName: IconType
    action: (id: string) => void
  }
}) => {
  return (
    <UploadedImageContainer key={image.id}>
      {image.status === 'pending' && <Loader size="large" />}
      {image.status === 'uploaded' && (
        <>
          <ImageBackground
            source={{ uri: image.url }}
            style={{
              width: '100%',
              height: '100%',
            }}
            imageStyle={{
              borderRadius: Radius[mode],
            }}
          />
        </>
      )}
      {actionButton && (
        <BinButtonContainer onPress={() => actionButton.action(image.id)}>
          <IconContainer name={actionButton.iconName} color={Colors.label} />
        </BinButtonContainer>
      )}
    </UploadedImageContainer>
  )
}

export const ImagesList = ({
  footer,
  images,
  actionButton,
}: {
  footer?: React.JSX.Element
  images: SelectedImage[]
  actionButton?: {
    iconName: IconType
    action: (id: string) => void
  }
}) => {
  return (
    <FlatList
      numColumns={3}
      keyExtractor={(item: SelectedImage) => item.id}
      data={images}
      columnWrapperStyle={{ gap: Spacing.gap.M }}
      ListFooterComponent={footer}
      renderItem={({ item }: { item: SelectedImage }) =>
        ImageListItem({ image: item, actionButton: actionButton })
      }
      contentContainerStyle={{
        justifyContent: 'space-between',
        gap: Spacing.gap.M,
      }}
    />
  )
}

const UploadedImageContainer = styled.View`
  flex-grow: 1;
  flex-basis: 0;
  flex-shrink: 1;
  height: 120px;
  align-items: center;
  justify-content: center;
`

const BinButtonContainer = styled.Pressable`
  position: absolute;
  bottom: 0;
  right: 0;
  background-color: ${Colors.background};
  border-top-left-radius: ${Radius.small}px;
  padding: 2px;
`
