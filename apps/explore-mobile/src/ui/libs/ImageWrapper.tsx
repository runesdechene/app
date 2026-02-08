import { ImageSourcePropType, ImageStyle, StyleProp } from 'react-native'
import styled from 'styled-components/native'

type Props = {
  source?: ImageSourcePropType
  style?: StyleProp<ImageStyle>
}

export const ImageWrapper = ({ source, style }: Props) => {
  return (
    <ImageContainer
      source={source}
      style={{ ...(style as any), resizeMode: 'stretch' }}
    />
  )
}

const ImageContainer = styled.Image`
  width: 100%;
  height: 100%;
`
