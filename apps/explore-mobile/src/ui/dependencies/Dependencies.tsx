import { Href } from 'expo-router'
import React, { createContext, useContext, useMemo, useRef } from 'react'
import { Provider as ReduxProvider } from 'react-redux'

import { SupabaseAccountGateway } from '@/adapters/supabase-account-gateway'
import { SupabaseAdminQueryGateway } from '@/adapters/supabase-admin-query-gateway'
import { SupabasePlacesCommandGateway } from '@/adapters/supabase-places-command-gateway'
import { SupabasePlacesFeedGateway } from '@/adapters/supabase-places-feed-gateway'
import { SupabasePlacesQueryGateway } from '@/adapters/supabase-places-query-gateway'
import { SupabaseReviewsGateway } from '@/adapters/supabase-reviews-gateway'
import { SupabaseSessionGateway } from '@/adapters/supabase-session-gateway'
import { SupabaseUsersQueryGateway } from '@/adapters/supabase-users-query-gateway'
import { IAlerter } from '@/shared/ports/alerter/alerter'
import { ConsoleAlerter } from '@/shared/ports/alerter/console-alerter'
import { IDateProvider } from '@/shared/ports/date/date-provider'
import { SystemDateProvider } from '@/shared/ports/date/system-date-provider'
import { DeviceEventEmitter } from '@/shared/ports/event-emitter/device-event-emitter'
import { IEventEmitter } from '@/shared/ports/event-emitter/event-emitter'
import { AppRouter } from '@/shared/ports/router/app-router'
import { IRouter } from '@/shared/ports/router/router'
import { AsyncStorage } from '@/shared/ports/storage/async-storage'
import { IStorage } from '@/shared/ports/storage/storage'
import { SupabaseMediaUploader } from '@/services/supabase-media-uploader'
import { AppStore, Dependencies, createStore } from '@/store/store'
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
import * as Application from 'expo-application'

const Context = createContext({} as Dependencies)

export const DependenciesProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const storage: IStorage = new AsyncStorage()
  const router: IRouter<Href> = new AppRouter()
  const dateProvider: IDateProvider = new SystemDateProvider()
  const alerter: IAlerter = new ConsoleAlerter()
  const eventEmitter: IEventEmitter = new DeviceEventEmitter()

  const authenticator = new SupabaseAuthenticator(storage)
  const getUserId = () => authenticator.getUserId()

  const sessionGateway: ISessionGateway = new SupabaseSessionGateway()
  const accountGateway: IAccountGateway = new SupabaseAccountGateway(getUserId)
  const placesFeedGateway: IPlacesFeedGateway =
    new SupabasePlacesFeedGateway(getUserId)
  const placesQueryGateway: IPlacesQueryGateway =
    new SupabasePlacesQueryGateway(getUserId)
  const placesCommandGateway: IPlacesCommandGateway =
    new SupabasePlacesCommandGateway(getUserId)
  const usersQueryGateway: IUsersQueryGateway =
    new SupabaseUsersQueryGateway()
  const reviewsGateway: IReviewsGateway = new SupabaseReviewsGateway(getUserId)
  const adminGateway: IAdminQueryGateway = new SupabaseAdminQueryGateway()

  const mediaUploader = new SupabaseMediaUploader(getUserId)

  const appVersion = `${Application.nativeApplicationVersion ?? ''} (${Application.nativeBuildVersion ?? ''})`

  const dependencies = useMemo<Dependencies>(
    () => ({
      storage,
      router,
      dateProvider,
      alerter,
      eventEmitter,

      sessionGateway,
      accountGateway,
      placesFeedGateway,
      placesQueryGateway,
      placesCommandGateway,
      usersQueryGateway,
      reviewsGateway,
      adminGateway,

      authenticator,
      locationService: new LocationService(alerter),
      mediaUploader,
      imageSelector: new ImageSelector(mediaUploader),
      appVersion,
    }),
    [],
  )

  const store = useRef<AppStore>()
  if (!store.current) {
    store.current = createStore({
      dependencies,
    })
  }

  return (
    <ReduxProvider store={store.current!}>
      <Context.Provider value={dependencies}>{children}</Context.Provider>
    </ReduxProvider>
  )
}

export const useDependencies = () => {
  return useContext(Context)
}
