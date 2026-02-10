import React, { FC, PropsWithChildren, ReactNode } from 'react'
import { Pressable, StyleProp, View, ViewStyle } from 'react-native'
import styled from 'styled-components/native'
import { ButtonColors, Colors, Radius, Spacing } from '../constants/Styles'
import { Flex } from './Flex'
import { IconContainer, IconType } from './IconContainer'
import { Title } from './Title'

const ButtonMode = {
  default: 'normal',
  round: 'round',
}

export type ButtonType = keyof typeof ButtonMode

const ButtonDatas = {
  S: {
    padding: {
      Xaxis: 'M',
      Yaxis: 'S',
    },
  },
  M: {
    padding: {
      Xaxis: 'L',
      Yaxis: 'M',
    },
  },
  L: {
    padding: {
      Xaxis: 'L',
      Yaxis: 'L',
    },
  },
}

export type ButtonProps = {
  type?: ButtonType
  size?: keyof typeof ButtonDatas
  color?: ButtonColors
  center?: boolean
  iconName?: IconType
  active?: boolean
  disable?: boolean
  noBorder?: boolean
  onPress?: () => void
  fullWidth?: boolean
  iconOnly?: boolean
  style?: StyleProp<ViewStyle>
  ref?: React.MutableRefObject<View | null>
  forceBackgroundImg?: any
  forcePictoImg?: ReactNode
}
export const Button: FC<PropsWithChildren<ButtonProps>> = ({
  type = 'default',
  size = 'M',
  color = 'default',
  active = false,
  center = true,
  iconName,
  onPress,
  children,
  disable,
  noBorder = false,
  fullWidth = true,
  iconOnly = false,
  style,
  forceBackgroundImg,
  forcePictoImg,
}) => {
  const getIconSize = (buttonSize: keyof typeof ButtonDatas) => {
    switch (buttonSize) {
      case 'M':
      case 'L':
        return 'L'
      default:
        return 'S'
    }
  }

  const getLabelSize = (buttonSize: keyof typeof ButtonDatas) => {
    switch (buttonSize) {
      case 'M':
        return 'h3'
      case 'L':
        return 'h2'
      default:
        return 'h4'
    }
  }

  const TypedButtonSpacer = iconOnly ? Pressable : ButtonSpacer

  return (
    <ButtonContainer
      type={type}
      color={color}
      active={active}
      onPress={() => {
        if (!disable && onPress) {
          onPress()
        }
      }}
      noBorder={noBorder}
      fullWidth={fullWidth}
      style={style}
    >
      {(color === 'special' || forceBackgroundImg) && (
        <ContainerBackground
          source={forceBackgroundImg ?? Colors.button.special.img_background}
          type={type}
          imageStyle={{ borderRadius: Radius[type] }}
        />
      )}
      <TypedButtonSpacer
        type={type}
        size={size}
        onPress={() => {
          if (!disable && onPress) {
            onPress()
          }
        }}
      >
        <Flex gap={size} direction="row" center={center}>
          {iconName && !forcePictoImg && (
            <IconContainer
              name={iconName}
              size={getIconSize(size)}
              color={Colors.button[color].text[active ? 'active' : 'default']}
            />
          )}
          {forcePictoImg}
          {type === 'default' && children && (
            <Title
              color={Colors.button[color].text[active ? 'active' : 'default']}
              size={getLabelSize(size)}
            >
              {children}
            </Title>
          )}
        </Flex>
      </TypedButtonSpacer>
    </ButtonContainer>
  )
}

const ContainerBackground = styled.ImageBackground<{ type: ButtonType }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`

const ButtonContainer = styled.Pressable<{
  color: ButtonColors
  active: boolean
  type: ButtonType
  noBorder: boolean
  fullWidth: boolean
}>`
  background-color: ${({ color, active }) =>
    Colors.button[color].background[active ? 'active' : 'default']};
  border: ${({ active, color, noBorder }) =>
    noBorder
      ? 'none'
      : Colors.button[color].border[active ? 'active' : 'default']};
  border-radius: ${({ type }) => Radius[type]}px;
  min-width: ${({ fullWidth }) => (fullWidth ? '100%' : '0')};
`

const ButtonSpacer = styled.Pressable<{
  size: keyof typeof ButtonDatas
  type: ButtonType
}>`
  padding-top: ${({ size, type }) =>
    Spacing.padding[
      type !== 'default'
        ? size
        : (ButtonDatas[size].padding.Yaxis as keyof typeof Spacing.padding)
    ]}px;
  padding-bottom: ${({ size, type }) =>
    Spacing.padding[
      type !== 'default'
        ? size
        : (ButtonDatas[size].padding.Yaxis as keyof typeof Spacing.padding)
    ]}px;
  padding-left: ${({ size, type }) =>
    Spacing.padding[
      type !== 'default'
        ? size
        : (ButtonDatas[size].padding.Xaxis as keyof typeof Spacing.padding)
    ]}px;
  padding-right: ${({ size, type }) =>
    Spacing.padding[
      type !== 'default'
        ? size
        : (ButtonDatas[size].padding.Xaxis as keyof typeof Spacing.padding)
    ]}px;
  border-radius: ${({ type }) => Radius[type]}px;
  background-color: transparent;
`
