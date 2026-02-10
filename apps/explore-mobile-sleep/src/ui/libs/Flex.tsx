import { FC, PropsWithChildren } from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import styled from 'styled-components/native'
import { Gap, Spacing } from '../constants'

type Props = {
  direction?: 'row' | 'column'
  gap?: Gap
  center?: boolean
  style?: StyleProp<ViewStyle>
}

export const Flex: FC<PropsWithChildren<Props>> = ({
  direction = 'column',
  gap = 'M',
  children,
  center = false,
  style,
}) => {
  return (
    <FlexContainer
      direction={direction}
      gap={gap}
      style={style}
      center={center}
    >
      {children}
    </FlexContainer>
  )
}

const FlexContainer = styled.View<{
  direction: 'row' | 'column'
  gap: Gap
  center: boolean
}>`
  display: flex;
  flex-direction: ${({ direction }) => direction};
  ${({ direction }) => (direction == 'row' ? 'align-items: center' : '')};
  ${({ center, direction }) =>
    center
      ? direction == 'row'
        ? 'justify-content: center'
        : 'align-items: center'
      : ''};
  gap: ${({ gap }) => Spacing.gap[gap]}${({ gap }) =>
      gap !== 'AUTO' ? 'px' : ''};
`
