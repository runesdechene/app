import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useQuery } from '@tanstack/react-query'

export const useUserProfileQuery = ({ userId }: { userId: string }) => {
  const dependencies = useDependencies()
  const query = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => dependencies.usersQueryGateway.getUserProfile(userId),
  })

  return {
    ...query,
  }
}
