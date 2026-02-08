import React, { useState } from 'react'
import styled from 'styled-components/native'
import { Colors } from '../constants'
import { Flex } from './Flex'
import { GapSeparator } from './GapSeparator'
import { IconContainer, IconType } from './IconContainer'
import { Title } from './Title'

type Tab = {
  key: string
  name: string
  content: any
  iconName?: IconType
  onClick?: (key: string) => void
}
export const Tabs = ({ tabs }: { tabs: Tab[] }) => {
  const [index, setIndex] = useState(0)
  const tab = tabs.find((_, i) => i === index)!

  return (
    <Flex
      style={{
        width: '100%',
        flexGrow: 1,
        alignItems: 'flex-start',
      }}
    >
      <Flex direction="row">
        {tabs.map((tab, i) => (
          <TabHeader
            key={tab.key}
            onPress={() => {
              setIndex(i)
              tab.onClick && tab.onClick(tab.key)
            }}
          >
            <Flex
              direction="row"
              style={{
                justifyContent:
                  i === 0 ? 'flex-start' : i === 2 ? 'flex-end' : 'center',
                alignItems: 'center',
                borderBottomColor: Colors.button.primary.background.active,
                borderBottomWidth: index === i ? 4 : 0,
              }}
            >
              {tab.iconName && (
                <IconContainer
                  name={tab.iconName}
                  size="S"
                  color={
                    index === i
                      ? Colors.button.primary.background.default
                      : Colors.label
                  }
                />
              )}
              <Title
                size="h3"
                color={
                  index === i
                    ? Colors.button.primary.background.default
                    : Colors.label
                }
              >
                {tab.name}
              </Title>
            </Flex>
          </TabHeader>
        ))}
      </Flex>
      <GapSeparator />
      <Flex
        key={tab.key}
        style={{
          flex: 1,
          flexBasis: 0,
          flexGrow: 1,
          width: '100%',
        }}
      >
        {tab.content}
      </Flex>
    </Flex>
  )
}

const TabHeader = styled.Pressable`
  flex: 1 1 0;
`
