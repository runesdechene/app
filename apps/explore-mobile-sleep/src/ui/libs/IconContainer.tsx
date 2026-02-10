import { StyleProp, ViewStyle } from 'react-native'
import styled from 'styled-components/native'
import {
  AlertIcon,
  BookmarkFillIcon,
  BookmarkIcon,
  ChevronLeft,
  CompassIcon,
  EasyIcon,
  EditIcon,
  EyeIcon,
  FlameIcon,
  HardIcon,
  HeartFillIcon,
  HeartIcon,
  HomeIcon,
  InstagramIcon,
  LinkIcon,
  MapPinIcon,
  MediumIcon,
  PinIcon,
  PlanetIcon,
  PlusIcon,
  RoundedPlusIcon,
  RuneIcon,
  SignalIcon,
  StarFillIcon,
  StarIcon,
  StarManyIcon,
  TentIcon,
  ThreeDotIcon,
  TrashIcon,
} from '../components/svg/icons'
import { Colors, IconSizes, Sizes } from '../constants/Styles'

const IconObject = {
  alert: AlertIcon,
  bookmark: BookmarkIcon,
  bookmarkFill: BookmarkFillIcon,
  chevronLeft: ChevronLeft,
  compass: CompassIcon,
  easy: EasyIcon,
  edit: EditIcon,
  eye: EyeIcon,
  flame: FlameIcon,
  hard: HardIcon,
  heart: HeartIcon,
  heartFill: HeartFillIcon,
  home: HomeIcon,
  instagram: InstagramIcon,
  link: LinkIcon,
  mapPin: MapPinIcon,
  medium: MediumIcon,
  pin: PinIcon,
  planet: PlanetIcon,
  plus: PlusIcon,
  roundedPlus: RoundedPlusIcon,
  rune: RuneIcon,
  signal: SignalIcon,
  star: StarIcon,
  starFill: StarFillIcon,
  starMany: StarManyIcon,
  tent: TentIcon,
  trash: TrashIcon,
  threeDot: ThreeDotIcon,
}

export type IconType = keyof typeof IconObject

const Container = styled.View<{ size: IconSizes }>`
  width: ${({ size }) => Sizes.icon[size]}px;
  height: ${({ size }) => Sizes.icon[size]}px;
`

type IconContainerProps = {
  name: IconType
  color?: string
  size?: IconSizes
  style?: StyleProp<ViewStyle>
}
export const IconContainer = ({
  color,
  name,
  size,
  style,
}: IconContainerProps) => {
  const TypedIcon = IconObject[name]
  if (TypedIcon) {
    return (
      <Container size={size ?? 'M'} style={style}>
        <TypedIcon color={color ?? Colors.label} />
      </Container>
    )
  }
  return null
}
