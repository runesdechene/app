import React, { useEffect, useState } from 'react'
import { Keyboard } from 'react-native'
import {
  FooterScreenBackground,
  HeaderScreenBackground,
} from './ScreenComponents'
import { ScreenBackgroundNoScroll, SpecificFlex } from './StyledComponents'

type Props = {
  children?: any
  footer?: {
    sticky?: boolean
  }
}

export {
  getBackButtonTemplate,
  getOptionButtonTemplate,
} from './ScreenComponents'

export { ScreenReductor } from './StyledComponents'

export const FlatListWrapperScreen = ({
  children,
  footer = {
    sticky: false,
  },
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
      <ScreenBackgroundNoScroll>
        <SpecificFlex>
          <HeaderScreenBackground />
          {children}
          <FooterScreenBackground sticky={footer.sticky ?? false} />
        </SpecificFlex>
      </ScreenBackgroundNoScroll>
    </>
  )
}
