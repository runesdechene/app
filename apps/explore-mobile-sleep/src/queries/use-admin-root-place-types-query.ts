import { useSession } from '@/hooks/use-session'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useQuery } from '@tanstack/react-query'

export const useAdminRootPlaceTypesQuery = () => {
  const dependencies = useDependencies()
  const { session } = useSession()
  const query = useQuery({
    queryKey: ['admin-place-types', 'root'],
    queryFn: async () => {
      return dependencies.adminGateway.getAdminRootPlaceTypes()
    },
    enabled: session?.user.role === 'admin',
  })

  return {
    ...query,
  }
}
