import {
  bookmarkPlaceAction,
  unBookmarkPlaceAction,
} from '@/store/place-actions'
import { ApiPlaceSummary } from '@model'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

type State = {
  places: ApiPlaceSummary[]
  total: number
}

const initialState: State = {
  places: [],
  total: 0,
}

export const bannerFeedSlice = createSlice({
  name: 'bannerFeeds',
  initialState,
  reducers: {
    set: (
      state,
      action: PayloadAction<{ places: ApiPlaceSummary[]; total: number }>,
    ) => {
      state.places = action.payload.places
      state.total = action.payload.total
    },
  },
  extraReducers: builder => {
    builder
      .addCase(bookmarkPlaceAction, (state, action) => {
        const place = state.places.find(
          (p: ApiPlaceSummary) => p.id === action.payload.placeId,
        )

        if (!place || !place.requester) {
          return
        }

        place.requester.bookmarked = true
      })
      .addCase(unBookmarkPlaceAction, (state, action) => {
        const place = state.places.find(
          (p: ApiPlaceSummary) => p.id === action.payload.placeId,
        )

        if (!place || !place.requester) {
          return
        }

        place.requester.bookmarked = false
      })
  },
})
