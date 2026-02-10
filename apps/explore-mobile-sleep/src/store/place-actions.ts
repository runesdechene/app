import { createAction } from '@reduxjs/toolkit'

export const bookmarkPlaceAction = createAction<{ placeId: string }>(
  'global/places/bookmark',
)

export const unBookmarkPlaceAction = createAction<{ placeId: string }>(
  'global/places/unbookmark',
)

export const likePlaceAction = createAction<{ placeId: string }>(
  'global/places/like',
)

export const unLikePlaceAction = createAction<{ placeId: string }>(
  'global/places/unlike',
)

export const explorePlaceAction = createAction<{ placeId: string }>(
  'global/places/explore',
)

export const unExplorePlaceAction = createAction<{ placeId: string }>(
  'global/places/unexplore',
)
