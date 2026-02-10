import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useMutation, UseMutationOptions } from '@tanstack/react-query'

type GetMapOptions = {
  latitude?: number
  longitude?: number
  latitudeDelta?: number
  longitudeDelta?: number
}

export const useMapPlacesQuery = (mutationOptions: UseMutationOptions) => {
  const dependencies = useDependencies()

  return useMutation({
    mutationFn: async (opts: GetMapOptions) => {
      return dependencies.placesFeedGateway.getMapPlaces({
        params: {
          type: 'all',
          ...opts,
        },
      })
    },
    // @ts-ignore ouais ouais
    onSuccess: mutationOptions?.onSuccess,
  })
}
