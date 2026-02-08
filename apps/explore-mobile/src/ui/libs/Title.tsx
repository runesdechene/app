import { Colors, Fonts, Sizes } from '@/ui/constants'
import { FC, PropsWithChildren } from 'react'
import { StyleProp, TextStyle } from 'react-native'
import styled from 'styled-components/native'

type Props = {
  size?: 'h1' | 'h2' | 'h3' | 'h4'
  color?: string
  grow?: boolean
  center?: boolean
  style?: StyleProp<TextStyle>
}

export const Title: FC<PropsWithChildren<Props>> = ({
  size = 'h1',
  color = Colors.text,
  grow = false,
  center = false,
  style,
  children,
}) => {
  return (
    <TitleStyled
      size={size}
      color={color}
      grow={grow}
      center={center}
      style={style}
    >
      {children}
    </TitleStyled>
  )
}

const TitleStyled = styled.Text<{
  color: string
  size: 'h1' | 'h2' | 'h3' | 'h4'
  grow: boolean
  center: boolean
}>`
  font-size: ${({ size }) => Sizes.title[size].size}px;
  line-height: ${({ size }) => Sizes.title[size].lineHeight}px;
  font-family: ${Fonts.Title};
  color: ${({ color }) => color};
  ${({ grow }) => (grow ? 'flex-grow:1;' : '')}
  text-align: ${({ center }) => (center ? 'center' : 'left')};
`
