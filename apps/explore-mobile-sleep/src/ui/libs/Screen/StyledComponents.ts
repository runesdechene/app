import { Colors, Spacing } from '@/ui/constants'
import styled from 'styled-components/native'

export const FooterBackgroundContainer = styled.View<{ sticky: boolean }>`
  height: 160px;
  width: 100%;
  margin-top: auto;
  position: ${({ sticky }) => (sticky ? 'absolute' : 'relative')};
  bottom: ${({ sticky }) => (sticky ? 0 : 'unset')};
`

export const HeaderBackgroundContainer = styled.View`
  height: 120px;
  background-color: ${Colors.superBackground};
  position: absolute;
  top: 0;
  width: 100%;
`
export const HeaderBackgroundImgContainer = styled.View`
  height: 80px;
  margin-top: auto;
  width: 100%;
`
export const ScreenReductor = styled.View`
  padding-left: ${Spacing.padding.screen}px;
  padding-right: ${Spacing.padding.screen}px;
  padding-top: ${Spacing.padding.screen}px;
  background-color: transparent;
`

export const ScreenBackgroundScroll = styled.ScrollView`
  background-color: ${Colors.background};
  width: 100%;
  min-height: 100%;
`

export const ScreenBackgroundNoScroll = styled.View<{
  backgroundColor?: string
}>`
  background-color: ${({ backgroundColor }) =>
    backgroundColor ?? Colors.background};
  width: 100%;
  min-height: 100%;
`

export const SpecificFlex = styled.View`
  display: flex;
  flex-direction: column;
  min-height: 100%;
`
