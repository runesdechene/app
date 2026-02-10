import { useSession } from '@/hooks/use-session'
import { router } from 'expo-router'
import styled from 'styled-components/native'
import { Sizes } from '../constants'
import { AvatarLink } from './Avatar'

export const AvatarHeader = () => {
  const { session, isAuthenticated } = useSession()
  return (
    <Container>
      <Logo
        source={require('@/ui/assets/images/logo-text-horizontal_colored.png')}
      />
      {isAuthenticated && (
        <AvatarLink
          onPress={() => router.push('/profile')}
          text={session!.user!.lastName[0]?.toUpperCase()}
          url={session!.user!.profileImage?.url}
          size="L"
        />
      )}
    </Container>
  )
}

const Container = styled.View`
  display: flex;
  flex-direction: row;
  width: 100%;
  height: ${Sizes.avatar.L}px;
  justify-content: space-between;
`

const Logo = styled.Image`
  height: 100%;
  width: 200px;
  object-fit: contain;
`
