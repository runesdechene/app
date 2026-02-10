import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useQuery } from '@tanstack/react-query'

export const useRootPlaceTypesQuery = () => {
  const dependencies = useDependencies()
  const query = useQuery({
    queryKey: ['place-types', 'root'],
    queryFn: async () => {
      return dependencies.placesQueryGateway.getRootPlaceTypes()
    },
  })

  return {
    ...query,
  }
}
