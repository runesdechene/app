import { placeDetailsSlice } from '@/store/place-details-slice'
import { useAppDispatch } from '@/store/store'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useQuery } from '@tanstack/react-query'

export const usePlaceDetailQuery = ({ placeId }: { placeId: string }) => {
  const dependencies = useDependencies()
  const query = useQuery({
    queryKey: ['place', placeId],
    queryFn: async () => {
      const place = await dependencies.placesQueryGateway.getPlaceById(placeId)
      dispatch(placeDetailsSlice.actions.set({ place }))

      return place
    },
  })

  const dispatch = useAppDispatch()

  return {
    ...query,
  }
}
