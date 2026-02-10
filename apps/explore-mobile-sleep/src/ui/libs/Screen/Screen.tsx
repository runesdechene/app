import React, { useEffect, useState } from 'react'
import { Keyboard } from 'react-native'
import { AvatarHeader } from '../AvatarHeader'
import { Flex } from '../Flex'
import { IconType } from '../IconContainer'
import {
  FooterScreenBackground,
  getBackButtonTemplate,
  getBackFloatingButtonTemplate,
  getOptionButtonTemplate,
  HeaderScreenBackground,
} from './ScreenComponents'
import {
  ScreenBackgroundScroll,
  ScreenReductor,
  SpecificFlex,
} from './StyledComponents'

type Props = {
  children?: any
  footer?: {
    sticky?: boolean
  }
  avatarHeader?: boolean
  backButton?: {
    label: string
    onBackButton: () => void
    floatingMode?: boolean
  }
  optionsButton?: {
    iconName?: IconType
    onOptionsButton: () => void
  }
}

export const Screen = ({
  children,
  footer = {
    sticky: false,
  },
  backButton,
  avatarHeader = false,
  optionsButton,
}: Props) => {
  const [keyboardOpen, setKeyboardOpen] = useState(Keyboard.isVisible)
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardOpen(true)
    })
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardOpen(false)
    })
    return () => {
      showSubscription.remove()
      hideSubscription.remove()
    }
  }, [])

  return (
    <>
      <ScreenBackgroundScroll>
        <SpecificFlex>
          <HeaderScreenBackground />
          {backButton &&
            !backButton?.floatingMode &&
            getBackButtonTemplate({
              label: backButton.label,
              onBackButton: backButton.onBackButton,
            })}

          <ScreenReductor>
            <Flex
              gap={'L'}
              style={{ height: footer.sticky ? '100%' : undefined }}
            >
              {avatarHeader && <AvatarHeader />}
              {children}
            </Flex>
          </ScreenReductor>
          {backButton &&
            backButton?.floatingMode &&
            getBackFloatingButtonTemplate({
              onBackButton: backButton.onBackButton,
            })}
          {optionsButton &&
            getOptionButtonTemplate({
              iconName: optionsButton.iconName,
              onOptionsButton: optionsButton.onOptionsButton,
            })}
          <FooterScreenBackground sticky={footer.sticky ?? false} />
        </SpecificFlex>
      </ScreenBackgroundScroll>
    </>
  )
}
