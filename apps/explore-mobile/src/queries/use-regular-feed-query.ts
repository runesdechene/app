import {
  bookmarkPlaceAction,
  unBookmarkPlaceAction,
} from '@/store/place-actions'
import { placeFeedSlice } from '@/store/place-feed-slice'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { ApiPlaceSummary } from '@model'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect } from 'react'

export type RegularFeedQueryParams =
  | {
      type: 'latest'
    }
  | {
      type: 'closest'
      location?: {
        latitude: number
        longitude: number
      }
    }
  | {
      type: 'popular'
    }

export const useRegularFeedQuery = (params: RegularFeedQueryParams) => {
  const dependencies = useDependencies()
  const query = useInfiniteQuery({
    queryKey: [
      'regular-feed',
      params.type,
      ...(params.type === 'closest' && params.location
        ? [params.location.latitude, params.location.longitude]
        : []),
    ],
    queryFn: async data => {
      if (params.type !== 'closest') {
        return dependencies.placesFeedGateway.getRegularFeed({
          params,
          page: data.pageParam,
          count: 30,
        })
      }

      return dependencies.placesFeedGateway.getRegularFeed({
        params: {
          type: 'closest',
          latitude: params.location?.latitude ?? 0,
          longitude: params.location?.longitude ?? 0,
        },
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
      placeFeedSlice.actions.set({
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
  const places = useAppSelector(state => state.placeFeed.places)

  return {
    data: places,
    isFetching: query.isFetching,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
    bookmark: useCallback(async (id: string) => {
      dispatch(bookmarkPlaceAction({ placeId: id }))
      try {
        await dependencies.placesCommandGateway.bookmarkPlace(id)
      } catch (e) {
        dispatch(unBookmarkPlaceAction({ placeId: id }))
        throw e
      }
    }, []),
    unBookmark: useCallback(async (id: string) => {
      dispatch(unBookmarkPlaceAction({ placeId: id }))
      try {
        await dependencies.placesCommandGateway.removeBookmarkPlace(id)
      } catch (e) {
        dispatch(bookmarkPlaceAction({ placeId: id }))
        throw e
      }
    }, []),
  }
}
