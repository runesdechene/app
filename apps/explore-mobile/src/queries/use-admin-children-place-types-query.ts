import { useSession } from '@/hooks/use-session'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useQuery } from '@tanstack/react-query'

export const useAdminChildrenPlaceTypesQuery = ({
  parentId,
}: {
  parentId: string
}) => {
  const dependencies = useDependencies()
  const { session } = useSession()
  const query = useQuery({
    queryKey: ['admin-place-types', parentId],
    queryFn: async () =>
      dependencies.adminGateway.getAdminChildPlaceTypes({
        parentId,
      }),
    enabled: session?.user.role === 'admin',
  })

  return {
    ...query,
  }
}
