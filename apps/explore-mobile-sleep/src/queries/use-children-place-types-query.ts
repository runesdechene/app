import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useQuery } from '@tanstack/react-query'

export const useChildrenPlaceTypesQuery = ({
  parentId,
}: {
  parentId: string
}) => {
  const dependencies = useDependencies()
  const query = useQuery({
    queryKey: ['place-types', parentId],
    queryFn: async () =>
      dependencies.placesQueryGateway.getChildPlaceTypes({
        parentId,
      }),
  })

  return {
    ...query,
  }
}
