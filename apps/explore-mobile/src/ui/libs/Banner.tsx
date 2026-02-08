import { ApiPlaceSummary } from '@model'
import * as ExpoLinking from 'expo-linking'
import { Pressable } from 'react-native'
import styled from 'styled-components/native'
import { Radius, Spacing } from '../constants'
import { ImageWrapper } from './ImageWrapper'

type Props = {
  data?: ApiPlaceSummary
}

export const Banner = ({ data }: Props) => {
  const openInstagram = () => {
    if (data?.url) {
      ExpoLinking.openURL(data.url)
    }
  }

  if (!data) return

  return (
    <Pressable
      onPress={openInstagram}
      style={{ marginTop: Number(Spacing.gap.S) }}
    >
      <BannerImgContainer>
        <ImageWrapper
          source={{
            uri: data.imageUrl as string,
          }}
          style={{ borderRadius: Radius.default }}
        />
      </BannerImgContainer>
    </Pressable>
  )
}

export const BannerImgContainer = styled.View`
  height: 80px;
`
