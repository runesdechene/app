import { PlaceIconSize, PlaceIconType, placeTypeService } from '@services'
import { ImageBackground, StyleProp, ViewStyle } from 'react-native'
import styled from 'styled-components/native'
import { IconSizes, Sizes } from '../constants/Styles'

const Container = styled.View<{ size: IconSizes }>`
  width: ${({ size }) => Sizes.icon[size]}px;
  height: ${({ size }) => Sizes.icon[size]}px;
`

type PlaceTypeContainerProps = {
  placeTypeName: PlaceIconType
  placeTypeSize: PlaceIconSize
  size?: IconSizes
  style?: StyleProp<ViewStyle>
}
export const PlaceTypeIconContainer = ({
  placeTypeName,
  placeTypeSize,
  size,
  style,
}: PlaceTypeContainerProps) => {
  const urlImg = placeTypeService.getImage(placeTypeName, placeTypeSize)
  if (urlImg) {
    return (
      <Container size={size ?? 'M'} style={style}>
        <ImageBackground
          source={urlImg}
          style={{ width: '100%', height: '100%' }}
          resizeMode="contain"
        />
      </Container>
    )
  }
  return null
}
