import { UserProfileScreen } from '@/screens/users/UserProfileScreen'
import { useLocalSearchParams } from 'expo-router'

export default function Page() {
  const params = useLocalSearchParams<{ userId: string }>()

  return <UserProfileScreen userId={params.userId} />
}
