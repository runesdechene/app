import AnnouncementScreen from '@/screens/announcement/AnnouncementScreen'
import {
  Button,
  Colors,
  IconContainer,
  isIos,
  LocationStarter,
  Radius,
  Spacing,
} from '@ui'
import { router, Tabs } from 'expo-router'
import React from 'react'
import 'react-native-reanimated'
import styled from 'styled-components/native'

export default function RootLayout() {
  const defaultTemplate = {
    paddingTop: 10,
    borderTopWidth: 0,
    borderRadius: Radius.round,
    marginLeft: Spacing.padding.screen,
    marginBottom: Spacing.padding.screen,
    width: 170,
    position: 'absolute',
    paddingLeft: 10,
    paddingRight: 10,
  }
  const iOsTemplate = {
    height: 72,
    paddingBottom: 16,
  }
  const androidTemplate = {
    height: 72,
    paddingBottom: 10,
  }
  return (
    <>
      <LocationStarter />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarInactiveTintColor: Colors.label,
          tabBarActiveTintColor: Colors.button.primary.background.active,
          tabBarIconStyle: {
            height: '100%',
            width: '100%',
          },
          // @ts-ignore position absolute trigger an error, but works!
          tabBarStyle: isIos()
            ? {
                ...defaultTemplate,
                ...iOsTemplate,
              }
            : {
                ...defaultTemplate,
                ...androidTemplate,
              },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            tabBarIcon: ({ color }) => (
              <IconContainer name="home" color={color} size="XL" />
            ),
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            tabBarIcon: ({ color }) => (
              <IconContainer name="planet" color={color} size="XL" />
            ),
          }}
        />
      </Tabs>
      <PlusContainer>
        <Button
          iconName="plus"
          type="round"
          fullWidth={false}
          size="L"
          color="special"
          onPress={() => router.push('/add')}
        />
      </PlusContainer>
      <AnnouncementScreen />
    </>
  )
}
const PlusContainer = styled.View`
  position: absolute;
  bottom: ${Spacing.padding.screen}px;
  right: ${Spacing.padding.screen}px;
`
