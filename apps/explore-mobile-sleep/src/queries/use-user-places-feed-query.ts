import { PaginatedResult } from '@/shared/api/pagination'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { ApiPlaceSummary } from '@model'
import { useInfiniteQuery } from '@tanstack/react-query'

export type UserPlacesFeedType = 'liked' | 'explored' | 'added' | 'bookmarked'

export const useUserPlacesFeedQuery = ({
  userId,
  type,
}: {
  userId: string
  type: UserPlacesFeedType
}) => {
  const dependencies = useDependencies()
  return useInfiniteQuery<PaginatedResult<ApiPlaceSummary>>({
    queryKey: ['user-places', userId, type],
    queryFn: async data => {
      switch (type) {
        case 'liked':
          return dependencies.placesFeedGateway.getLikedPlaces({
            params: {
              userId,
            },
            //@ts-ignore
            page: data.pageParam,
          })
        case 'explored':
          return dependencies.placesFeedGateway.getExploredPlaces({
            params: {
              userId,
            },
            //@ts-ignore
            page: data.pageParam,
          })
        case 'added':
          return dependencies.placesFeedGateway.getAddedPlaces({
            params: {
              userId,
            },
            //@ts-ignore
            page: data.pageParam,
          })
        case 'bookmarked':
          return dependencies.placesFeedGateway.getBookmarkedPlaces({
            params: {
              userId,
            },
            //@ts-ignore
            page: data.pageParam,
          })
      }
    },
    initialPageParam: 1,
    getNextPageParam: lastPage => {
      const hasNextPage =
        lastPage.meta.total !== 0 &&
        lastPage.meta.page !==
          Math.ceil(lastPage.meta.total / lastPage.meta.count)
      return hasNextPage ? lastPage.meta.page + 1 : undefined
    },
  })
}
