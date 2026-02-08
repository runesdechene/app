import { SvgXml } from 'react-native-svg'
import { Colors } from '../../../constants'
import { SizeType } from '../../../primitives'

export type PlaceTypeSvgType = {
  fill?: string
  size: SizeType
}

export const PlaceTypeSvg = ({
  fill,
  size,
  xml,
  ratio,
}: PlaceTypeSvgType & { xml: string; ratio: number }) => {
  const currentHeight = size === 'S' ? 100 : 180
  const currentWidth = currentHeight * ratio
  return (
    <SvgXml
      xml={xml}
      width={currentWidth}
      height={currentHeight}
      fill={fill ?? Colors.text}
      style={{ alignSelf: 'flex-end' }}
    />
  )
}
