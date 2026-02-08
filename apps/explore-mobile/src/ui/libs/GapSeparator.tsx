import { View } from 'react-native'
import { Colors } from '../constants'

type Props = {
  separator?: boolean
}
export const GapSeparator = ({ separator = false }: Props) => {
  return (
    <View
      style={{
        width: '100%',
        height: !!separator ? 1 : 0,
        backgroundColor: Colors.separator,
      }}
    />
  )
}
