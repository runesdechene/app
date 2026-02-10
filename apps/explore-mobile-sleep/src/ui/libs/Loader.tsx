import { Colors } from '@/ui/constants'
import { FC } from 'react'
import { ActivityIndicator } from 'react-native'

type Props = {
  size?: 'small' | 'large'
}

export const Loader: FC<Props> = ({ size = 'large' }) => {
  return <ActivityIndicator size={size} color={Colors.label} />
}
