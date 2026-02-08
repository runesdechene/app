import { FC, PropsWithChildren } from 'react'
import { ImageBackground } from 'react-native'
import styled from 'styled-components/native'
import { AvatarSizes, Colors, Radius, Sizes } from '../constants'
import { Link } from './Link'
import { Title } from './Title'

type AvatarProps = {
  size?: AvatarSizes
  url?: string | null
  text?: string
}

export const Avatar: FC<PropsWithChildren<AvatarProps>> = ({
  size = 'M',
  url,
  text,
}) => {
  return (
    <AvatarContainer size={size} textMode={!url}>
      {!!url && (
        <ImageBackground
          source={{ uri: url }}
          style={{ width: Sizes.avatar[size], height: Sizes.avatar[size] }}
          imageStyle={{ borderRadius: Radius.round }}
        />
      )}
      {!url && !!text && (
        <Title color={Colors.label} size="h2">
          {text}
        </Title>
      )}
    </AvatarContainer>
  )
}

const AvatarContainer = styled.View<{ size: AvatarSizes; textMode: boolean }>`
  width: ${({ size }) => Sizes.avatar[size]}px;
  height: ${({ size }) => Sizes.avatar[size]}px;
  border-radius: ${Radius.round}px;
  background-color: ${({ textMode }) =>
    textMode ? Colors.button.disable.background.default : 'none'};
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
`

export const AvatarLink: FC<
  PropsWithChildren<AvatarProps & { onPress: () => void }>
> = ({ onPress, ...rest }) => {
  return (
    <Link onPress={onPress}>
      <Avatar {...rest} />
    </Link>
  )
}
