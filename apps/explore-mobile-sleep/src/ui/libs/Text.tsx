import { Colors, Fonts, Sizes } from '@/ui/constants'
import { Link as ExpoLink, Href } from 'expo-router'
import { FC, PropsWithChildren } from 'react'
import { StyleProp, TextStyle } from 'react-native'
import styled from 'styled-components/native'
import { Link } from './Link'

type Props = {
  size?: 'S' | 'M'
  color?: string
  align?: 'justify' | 'center' | 'start'
  width?: string
  style?: StyleProp<TextStyle>
}

export const Text: FC<PropsWithChildren<Props>> = ({
  size = 'M',
  color = Colors.text,
  align = 'justify',
  width,
  style,
  children,
}) => {
  return (
    <TextStyled
      size={size}
      color={color}
      align={align}
      width={width}
      style={style}
    >
      {children}
    </TextStyled>
  )
}

const TextStyled = styled.Text<{
  color: string
  size: 'S' | 'M'
  align: string
  width?: string
}>`
  font-size: ${({ size }) => Sizes.text[size].size}px;
  line-height: ${({ size }) => Sizes.text[size].lineHeight}px;
  font-family: ${Fonts.Text.Regular};
  color: ${({ color }) => color};
  text-align: ${({ align }) => align};
  ${({ width }) => (width ? `width: ${width};` : '')}
  max-width: 100%;
`

export const TextBold: FC<PropsWithChildren<Props>> = ({
  size = 'M',
  color = Colors.text,
  align = 'justify',
  children,
}) => {
  return (
    <TextBoldStyled size={size} color={color} align={align}>
      {children}
    </TextBoldStyled>
  )
}

const TextBoldStyled = styled.Text<{
  color: string
  size: 'S' | 'M'
  align: string
}>`
  font-size: ${({ size }) => Sizes.text[size].size}px;
  line-height: ${({ size }) => Sizes.text[size].lineHeight}px;
  font-family: ${Fonts.Text.Bold};
  color: ${({ color }) => color};
  text-align: ${({ align }) => align};
`

export const TextLink: FC<
  PropsWithChildren<Props & { onPress: () => void }>
> = ({ onPress, ...rest }) => {
  return (
    <Link onPress={onPress}>
      <Text color={Colors.link} {...rest} />
    </Link>
  )
}

export const TextBoldLink: FC<
  PropsWithChildren<Props & { onPress: () => void }>
> = ({ onPress, ...rest }) => {
  return (
    <Link onPress={onPress}>
      <TextBold color={Colors.link} {...rest} />
    </Link>
  )
}

export const InlineLink: FC<PropsWithChildren<{ href: Href }>> = ({
  href,
  children,
}) => {
  return (
    <ExpoLink
      href={href}
      style={{ color: Colors.link, fontFamily: Fonts.Text.Bold }}
    >
      {children}
    </ExpoLink>
  )
}
