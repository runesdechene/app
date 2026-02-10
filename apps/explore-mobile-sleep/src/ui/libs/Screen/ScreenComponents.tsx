import { ButtonColors, Spacing } from '@/ui/constants'
import { StyleProp, ViewStyle } from 'react-native'
import { Button } from '../Button'
import { IconType } from '../IconContainer'
import { ImageWrapper } from '../ImageWrapper'
import {
  FooterBackgroundContainer,
  HeaderBackgroundContainer,
  HeaderBackgroundImgContainer,
} from './StyledComponents'

export const HeaderScreenBackground = () => {
  return (
    <HeaderBackgroundContainer>
      <HeaderBackgroundImgContainer>
        <ImageWrapper
          source={require('@/ui/assets/images/background_header.webp')}
        />
      </HeaderBackgroundImgContainer>
    </HeaderBackgroundContainer>
  )
}

export const FooterScreenBackground = ({ sticky }: { sticky: boolean }) => {
  return (
    <FooterBackgroundContainer sticky={sticky ?? false}>
      <ImageWrapper
        source={
          sticky
            ? require('@/ui/assets/images/footer_bg.png')
            : require('@/ui/assets/images/footer_bg_clean.png')
        }
      />
    </FooterBackgroundContainer>
  )
}

export type BackButtonType = {
  label: string
  onBackButton: () => void
  customStyle?: StyleProp<ViewStyle>
}
export const getBackButtonTemplate = ({
  label,
  onBackButton,
  customStyle,
}: BackButtonType) => {
  return (
    <Button
      size="L"
      iconName="chevronLeft"
      color="invisible"
      onPress={onBackButton}
      style={[
        {
          alignItems: 'flex-start',
        },
        customStyle,
      ]}
    >
      {label}
    </Button>
  )
}

export const getBackFloatingButtonTemplate = ({
  onBackButton,
}: {
  onBackButton: () => void
}) => {
  return (
    <Button
      size="S"
      iconName="chevronLeft"
      onPress={onBackButton}
      type="default"
      fullWidth={false}
      noBorder
      style={{
        position: 'absolute',
        top: 0,
        margin: Spacing.padding.screen,
        paddingTop: Spacing.padding.S / 2,
        paddingBottom: Spacing.padding.S / 2,
      }}
    />
  )
}

export type OptionButtonType = {
  iconName?: IconType
  onOptionsButton: () => void
  customStyle?: StyleProp<ViewStyle>
  buttonMode?: 'icon' | 'button'
  buttonText?: string
  buttonColor?: ButtonColors
  buttonSize?: 'S' | 'M' | 'L'
}
export const getOptionButtonTemplate = ({
  iconName,
  onOptionsButton,
  customStyle,
  buttonText,
  buttonColor,
  buttonSize,
}: OptionButtonType) => {
  return (
    <Button
      size={buttonSize ?? 'L'}
      iconName={iconName}
      onPress={onOptionsButton}
      type="default"
      color={buttonColor ?? 'invisible'}
      fullWidth={false}
      noBorder
      style={[
        {
          position: 'absolute',
          top: 0,
          right: 0,
        },
        customStyle,
      ]}
    >
      {buttonText}
    </Button>
  )
}
