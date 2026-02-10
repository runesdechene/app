import {
  combineReducers,
  configureStore,
  createListenerMiddleware,
} from '@reduxjs/toolkit'
import devToolsEnhancer from 'redux-devtools-expo-dev-plugin'

import { IAlerter } from '@/shared/ports/alerter/alerter'
import { IDateProvider } from '@/shared/ports/date/date-provider'
import { IEventEmitter } from '@/shared/ports/event-emitter/event-emitter'
import { IRouter } from '@/shared/ports/router/router'
import { IStorage } from '@/shared/ports/storage/storage'
import { placeDetailsSlice } from '@/store/place-details-slice'
import { placeFeedSlice } from '@/store/place-feed-slice'
import {
  IAccountGateway,
  IAdminQueryGateway,
  IPlacesCommandGateway,
  IPlacesFeedGateway,
  IPlacesQueryGateway,
  IReviewsGateway,
  ISessionGateway,
  IUsersQueryGateway,
} from '@ports'
import {
  ImageSelector,
  LocationService,
} from '@services'
import { SupabaseAuthenticator } from '@/services/supabase-authenticator'
import { SupabaseMediaUploader } from '@/services/supabase-media-uploader'
import { Href } from 'expo-router'
import {
  TypedUseSelectorHook,
  useDispatch,
  useSelector,
  useStore,
} from 'react-redux'
import { bannerFeedSlice } from './banner-feed-slice'

export type Dependencies = {
  storage: IStorage
  router: IRouter<Href>
  dateProvider: IDateProvider
  alerter: IAlerter
  eventEmitter: IEventEmitter

  // Adapters
  sessionGateway: ISessionGateway
  accountGateway: IAccountGateway
  placesFeedGateway: IPlacesFeedGateway
  placesQueryGateway: IPlacesQueryGateway
  placesCommandGateway: IPlacesCommandGateway
  usersQueryGateway: IUsersQueryGateway
  reviewsGateway: IReviewsGateway
  adminGateway: IAdminQueryGateway

  // Services
  authenticator: SupabaseAuthenticator
  locationService: LocationService
  mediaUploader: SupabaseMediaUploader
  imageSelector: ImageSelector

  appVersion: string
}

const reducers = combineReducers({
  placeFeed: placeFeedSlice.reducer,
  placeDetails: placeDetailsSlice.reducer,
  bannerFeed: bannerFeedSlice.reducer,
})

export const createStore = (config: {
  dependencies: Dependencies
  initialState?: RootState
}) => {
  return configureStore({
    preloadedState: config?.initialState,
    reducer: reducers,
    devTools: true,
    enhancers: getDefaultEnhancers =>
      getDefaultEnhancers().concat(devToolsEnhancer()),
    // @ts-ignore
    middleware: getDefaultMiddleware => {
      const listener = createListenerMiddleware()
      return getDefaultMiddleware({
        thunk: {
          extraArgument: config.dependencies,
        },
      }).prepend(listener.middleware)
    },
  })
}

export type AppStore = ReturnType<typeof createStore>
export type RootState = ReturnType<typeof reducers>
export type AppDispatch = AppStore['dispatch']
export type AppGetState = AppStore['getState']

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
export const useAppStore: () => AppStore = useStore
