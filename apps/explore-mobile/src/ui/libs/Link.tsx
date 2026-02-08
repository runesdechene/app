import { FC, PropsWithChildren } from 'react'
import { Pressable } from 'react-native'

type Props = {
  onPress: () => void
}

export const Link: FC<PropsWithChildren<Props>> = ({ onPress, children }) => {
  return <Pressable onPress={onPress}>{children}</Pressable>
}
