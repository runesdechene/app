import React, { Fragment, useEffect, useState } from 'react'
import { Keyboard } from 'react-native'
import { AvatarHeader } from '../AvatarHeader'
import { Flex } from '../Flex'
import {
  FooterScreenBackground,
  getBackButtonTemplate,
  getOptionButtonTemplate,
  HeaderScreenBackground,
  OptionButtonType,
} from './ScreenComponents'
import {
  ScreenBackgroundNoScroll,
  ScreenReductor,
  SpecificFlex,
} from './StyledComponents'

type Props = {
  children?: any
  footer?: {
    sticky?: boolean
  }
  header?: {
    hideBackground?: boolean
    backgroundColor?: string
  }
  avatarHeader?: boolean
  backButton?: {
    label: string
    onBackButton: () => void
  }
  optionsButton?: OptionButtonType
  preventPadding?: boolean
}

export const FixedScreen = ({
  children,
  footer = {
    sticky: false,
  },
  header = {
    hideBackground: false,
    backgroundColor: undefined,
  },
  backButton,
  avatarHeader = false,
  optionsButton,
  preventPadding = false,
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

  const ScreenReductorTyped = preventPadding ? Fragment : ScreenReductor

  return (
    <>
      <ScreenBackgroundNoScroll backgroundColor={header.backgroundColor}>
        <SpecificFlex>
          {!header.hideBackground && <HeaderScreenBackground />}
          {backButton &&
            getBackButtonTemplate({
              label: backButton.label,
              onBackButton: backButton.onBackButton,
            })}
          <ScreenReductorTyped>
            <Flex
              gap={'L'}
              style={{
                height: footer.sticky ? '100%' : undefined,
              }}
            >
              {avatarHeader && <AvatarHeader />}
              {children}
            </Flex>
          </ScreenReductorTyped>
          {optionsButton && getOptionButtonTemplate(optionsButton)}
          <FooterScreenBackground sticky={footer.sticky ?? false} />
        </SpecificFlex>
      </ScreenBackgroundNoScroll>
    </>
  )
}
