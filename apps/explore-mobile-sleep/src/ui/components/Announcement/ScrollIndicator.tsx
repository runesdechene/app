import { Colors } from '@/ui/constants'
import { Flex } from '@/ui/libs'
import React from 'react'
import { Animated, StyleSheet } from 'react-native'
import { Feature } from './Announcement'

type ScrollIndicatorProps = {
  scrollX: Animated.Value
  data: Feature[]
  announcementWidth: number
}

const ScrollIndicator = ({
  scrollX,
  data,
  announcementWidth,
}: ScrollIndicatorProps) => {
  return (
    <Flex direction="row" center gap="NONE">
      {data.map((_, index) => {
        const inputRange = [
          (index - 1) * announcementWidth,
          index * announcementWidth,
          (index + 1) * announcementWidth,
        ]

        const backgroundColor = scrollX.interpolate({
          inputRange,
          outputRange: [Colors.separator, Colors.label, Colors.separator],
          extrapolate: 'clamp',
        })

        return (
          <Animated.View
            key={`indicator-${index}`}
            style={[styles.indicator, { backgroundColor: backgroundColor }]}
          />
        )
      })}
    </Flex>
  )
}

const styles = StyleSheet.create({
  indicator: {
    height: 8,
    width: 8,
    borderRadius: 4,
    marginHorizontal: 8,
  },
})

export default ScrollIndicator
