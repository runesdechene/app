import { useSession } from '@/hooks/use-session'
import { bannerFeedSlice } from '@/store/banner-feed-slice'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { ApiPlaceSummary } from '@model'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect } from 'react'

export type BannerFeedQueryParams =
  | {
      type: 'latest'
    }
  | {
      type: 'all'
    }

export const useBannerFeedQuery = (params: BannerFeedQueryParams) => {
  const dependencies = useDependencies()
  const { session } = useSession()
  const query = useInfiniteQuery({
    queryKey: ['banner-feed', params.type],
    queryFn: async data => {
      return dependencies.placesFeedGateway.getBannerFeed({
        params,
        page: data.pageParam,
        count: 30,
      })
    },
    initialPageParam: 1,
    getNextPageParam: lastPage => lastPage.meta.page + 1,
  })

  useEffect(() => {
    const allData = query.data?.pages
      .map(page => page.data)
      .flat() as ApiPlaceSummary[]

    dispatch(
      bannerFeedSlice.actions.set({
        places: allData,
        total: query.data?.pages[0].meta.total ?? 0,
      }),
    )
  }, [query.data])

  useFocusEffect(
    useCallback(() => {
      query.refetch()
    }, []),
  )

  const dispatch = useAppDispatch()
  const places = useAppSelector(state => state.bannerFeed.places)

  return {
    data: places,
    isFetching: query.isFetching,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
  }
}
