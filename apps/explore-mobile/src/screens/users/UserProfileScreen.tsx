import { useUserProfileQuery } from '@/queries/use-user-profile-query'
import { ProfileScreen } from '@/screens/users/profile/ProfileScreen'
import { ErrorScreen, LoadingScreen } from '@ui'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'

export const UserProfileScreen = ({ userId }: { userId: string }) => {
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
