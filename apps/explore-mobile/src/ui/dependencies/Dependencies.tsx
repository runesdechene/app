import { Href } from 'expo-router'
import React, { createContext, useContext, useMemo, useRef } from 'react'
import { Provider as ReduxProvider } from 'react-redux'

import { HttpAccountGateway } from '@/adapters/http-account-gateway'
import { HttpAdminQueryGateway } from '@/adapters/http-admin-query-gateway'
import { HttpPlacesCommandGateway } from '@/adapters/http-places-command-gateway'
import { HttpPlacesFeedGateway } from '@/adapters/http-places-feed-gateway'
import { HttpPlacesQueryGateway } from '@/adapters/http-places-query-gateway'
import { HttpReviewsGateway } from '@/adapters/http-reviews-gateway'
import { HttpSessionGateway } from '@/adapters/http-session-gateway'
import { HttpUsersQueryGateway } from '@/adapters/http-users-query-gateway'
import { AxiosHttpClient } from '@/shared/http/clients/axios-http-client'
import { IHttpClient } from '@/shared/http/http-client.interface'
import { HttpRemote } from '@/shared/http/http-remote'
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
  Authenticator,
  ImageSelector,
  LocationService,
  MediaUploader,
} from '@services'
import * as Application from 'expo-application'

const Context = createContext({} as Dependencies)

export const DependenciesProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const storage: IStorage = new AsyncStorage()
  const router: IRouter<Href> = new AppRouter()
  const httpClient: IHttpClient = new AxiosHttpClient(
    // @ts-ignore
    new HttpRemote(process.env.EXPO_PUBLIC_API_URL),
  )
  const dateProvider: IDateProvider = new SystemDateProvider()
  const alerter: IAlerter = new ConsoleAlerter()
  const eventEmitter: IEventEmitter = new DeviceEventEmitter()

  const sessionGateway: ISessionGateway = new HttpSessionGateway(httpClient)
  const accountGateway: IAccountGateway = new HttpAccountGateway(httpClient)
  const placesFeedGateway: IPlacesFeedGateway = new HttpPlacesFeedGateway(
    httpClient,
  )
  const placesQueryGateway: IPlacesQueryGateway = new HttpPlacesQueryGateway(
    httpClient,
  )
  const placesCommandGateway: IPlacesCommandGateway =
    new HttpPlacesCommandGateway(httpClient)

  const usersQueryGateway: IUsersQueryGateway = new HttpUsersQueryGateway(
    httpClient,
  )

  const reviewsGateway: IReviewsGateway = new HttpReviewsGateway(httpClient)

  const adminGateway: IAdminQueryGateway = new HttpAdminQueryGateway(httpClient)

  const appVersion = `${Application.nativeApplicationVersion ?? ''} (${Application.nativeBuildVersion ?? ''})`

  const dependencies = useMemo<Dependencies>(
    () => ({
      storage,
      router,
      httpClient,
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

      authenticator: new Authenticator(
        sessionGateway,
        storage,
        httpClient,
        dateProvider,
      ),
      locationService: new LocationService(alerter),
      mediaUploader: new MediaUploader(httpClient),
      imageSelector: new ImageSelector(new MediaUploader(httpClient)),
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
