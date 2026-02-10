import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useQuery } from '@tanstack/react-query'

export const useAdminStatsQuery = () => {
  const dependencies = useDependencies()
  const query = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => dependencies.adminGateway.getStats(),
  })

  return {
    ...query,
  }
}
