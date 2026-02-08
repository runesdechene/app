import {
  bookmarkPlaceAction,
  explorePlaceAction,
  likePlaceAction,
  unBookmarkPlaceAction,
  unExplorePlaceAction,
  unLikePlaceAction,
} from '@/store/place-actions'
import { ApiPlaceDetail } from '@model'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

type State = {
  places: Record<string, ApiPlaceDetail>
}

const initialState: State = {
  places: {},
}

export const placeDetailsSlice = createSlice({
  name: 'placeDetails',
  initialState,
  reducers: {
    set: (state, action: PayloadAction<{ place: ApiPlaceDetail }>) => {
      const place = action.payload.place
      state.places[place.id] = place
    },
  },
  extraReducers: builder =>
    builder
      .addCase(bookmarkPlaceAction, (state, action) => {
        const place = state.places[action.payload.placeId]
        if (!place || !place.requester) {
          return
        }

        place.requester.bookmarked = true
      })
      .addCase(unBookmarkPlaceAction, (state, action) => {
        const place = state.places[action.payload.placeId]
        if (!place || !place.requester) {
          return
        }

        place.requester.bookmarked = false
      })
      .addCase(likePlaceAction, (state, action) => {
        const place = state.places[action.payload.placeId]
        if (!place || !place.requester) {
          return
        }

        place.requester.liked = true
        place.metrics.likes += 1
      })
      .addCase(unLikePlaceAction, (state, action) => {
        const place = state.places[action.payload.placeId]
        if (!place || !place.requester) {
          return
        }

        place.requester.liked = false
        place.metrics.likes -= 1
      })
      .addCase(explorePlaceAction, (state, action) => {
        const place = state.places[action.payload.placeId]
        if (!place || !place.requester) {
          return
        }

        place.requester.explored = true
        place.metrics.explored += 1
      })
      .addCase(unExplorePlaceAction, (state, action) => {
        const place = state.places[action.payload.placeId]
        if (!place || !place.requester) {
          return
        }

        place.requester.explored = false
        place.metrics.explored -= 1
      }),
})
