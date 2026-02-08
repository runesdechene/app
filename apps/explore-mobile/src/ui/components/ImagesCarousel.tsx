import { Colors, Spacing } from '@/ui/constants'
import { Button } from '@/ui/libs'
import { ApiPlaceDetailImage, ApiPlaceType } from '@model'
import { placeTypeService } from '@services'
import { useState } from 'react'
import { ImageBackground, Modal, Pressable } from 'react-native'
import PagerView from 'react-native-pager-view'
import styled from 'styled-components/native'

export const ModalImgCarousel = ({
  imgUrl,
  setImgUrl,
}: {
  imgUrl: string
  setImgUrl: (path: string) => void
}) => {
  return (
    <Modal
      animationType="fade"
      visible={Boolean(imgUrl)}
      transparent={false}
      onRequestClose={() => setImgUrl('')}
    >
      <ImageBackground
        source={{ uri: imgUrl }}
        resizeMode="contain"
        style={{ width: '100%', height: '100%' }}
      />
      <CloserContainer>
        <Button onPress={() => setImgUrl('')} size="M" fullWidth={false}>
          Fermer l'aperçu
        </Button>
      </CloserContainer>
    </Modal>
  )
}

export const ImagesCarousel = ({
  images,
  placeType,
}: {
  images: ApiPlaceDetailImage[]
  placeType?: ApiPlaceType
}) => {
  const [modalUrl, setModalUrl] = useState('')
  const [imageIndex, setImageIndex] = useState(0)

  return (
    <ContentOutsideBox>
      <PagerView
        initialPage={imageIndex}
        onPageSelected={x => {
          setImageIndex(x.nativeEvent.position)
        }}
        style={{ width: '100%', height: '100%' }}
      >
        {images.map(image => (
          <Pressable key={image.id} onPress={() => setModalUrl(image.url)}>
            <ImageBackground
              source={{ uri: image.url }}
              resizeMode="cover"
              style={{ width: '100%', height: '100%' }}
            />
          </Pressable>
        ))}
      </PagerView>
      {images.length > 1 && (
        <CarouselIndicator>
          {images.map((_, index) => (
            <CarouselDot key={index} $active={index === imageIndex} />
          ))}
        </CarouselIndicator>
      )}
      <ModalImgCarousel imgUrl={modalUrl} setImgUrl={setModalUrl} />
      {placeType && (
        <SeperatorImg>
          {placeTypeService.getSvgBackgroung(placeType, Colors.background)}
        </SeperatorImg>
      )}
    </ContentOutsideBox>
  )
}

const ContentOutsideBox = styled.View`
  height: 500px;
  margin-left: -${Spacing.padding.screen}px;
  margin-right: -${Spacing.padding.screen}px;
  margin-top: -${Spacing.padding.screen}px;
`
const CarouselIndicator = styled.View`
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;

  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
`
const CarouselDot = styled.View<{ $active?: boolean }>`
  width: 6px;
  height: 6px;

  border-radius: 5px;
  margin: 0 3px;

  background-color: ${({ $active }) =>
    $active ? 'white' : 'rgba(255, 255, 255, 0.4)'};
`

const SeperatorImg = styled.View`
  height: 100px;
  width: 100%;
  position: absolute;
  bottom: -5px;
`
const CloserContainer = styled.View`
  position: absolute;
  bottom: 0;
  width: 100%;
  right: 0;
  padding-left: ${Spacing.padding.screen}px;
  padding-right: ${Spacing.padding.screen}px;
  padding-bottom: ${Spacing.padding.screen}px;
`
