import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useMutation, UseMutationOptions } from '@tanstack/react-query'

type GetMapOptions = {
  latitude?: number
  longitude?: number
  latitudeDelta?: number
  longitudeDelta?: number
}

export const useMapBannersQuery = (mutationOptions: UseMutationOptions) => {
  const dependencies = useDependencies()

  return useMutation({
    mutationFn: async (opts: GetMapOptions) => {
      return dependencies.placesFeedGateway.getMapBanners({
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
