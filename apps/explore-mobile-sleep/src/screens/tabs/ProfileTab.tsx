import { useSession } from '@/hooks/use-session'
import { useUserProfileQuery } from '@/queries/use-user-profile-query'
import { LoginScreen } from '@/screens/auth/login/LoginScreen'
import { ProfileScreen } from '@/screens/users/profile/ProfileScreen'
import { ErrorScreen, LoadingScreen } from '@ui'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'

export const ProfileTab = () => {
  const { session, isAuthenticated } = useSession()

  return isAuthenticated ? (
    <AuthenticatedTab userId={session!.user.id} />
  ) : (
    <GuestTab />
  )
}

const AuthenticatedTab = ({ userId }: { userId: string }) => {
  const query = useUserProfileQuery({ userId })

  useFocusEffect(
    useCallback(() => {
      query.refetch()
    }, []),
  )

  if (query.isLoading) return <LoadingScreen />
  if (query.isError) return <ErrorScreen>{query.error}</ErrorScreen>

  return <ProfileScreen user={query.data!} />
}

const GuestTab = () => {
  return <LoginScreen />
}
