import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useQuery } from '@tanstack/react-query'

export const useTotalPlacesQuery = () => {
  const dependencies = useDependencies()
  const query = useQuery({
    queryKey: ['places_stat'],
    queryFn: async () => {
      const place = await dependencies.placesQueryGateway.getTotalPlaces()
      return place
    },
  })

  return {
    ...query,
  }
}
